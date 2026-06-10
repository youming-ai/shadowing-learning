import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { apiError, apiSuccess } from '~/lib/utils/api-response'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitConfig,
  getRateLimitHeaders,
} from '~/lib/utils/rate-limiter'
import { fetchTranscriptCues, getVideoMeta, YouTubeSourceError } from '~/lib/youtube/innertube'
import { mergeShortCues, msCuesToSeconds } from '~/lib/youtube/normalize'
import { selectCaptionTrack } from '~/lib/youtube/track-select'
import { isValidVideoId } from '~/lib/youtube/url'

const bodySchema = z.object({
  videoId: z.string(),
  preferredLanguage: z.string().optional(),
})

export async function handleCaptionsPost(request: Request): Promise<Response> {
  const clientId = getClientIdentifier(request)
  const config = getRateLimitConfig('/api/youtube/captions')
  const limit = checkRateLimit(`yt-captions:${clientId}`, config)
  if (limit.limited) {
    return apiError({
      code: 'RATE_LIMITED',
      message: config.message ?? '请求过于频繁',
      details: { retryAfter: limit.retryAfter },
      statusCode: 429,
      headers: getRateLimitHeaders(limit),
    })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success || !isValidVideoId(parsed.data.videoId)) {
    return apiError({ code: 'INVALID_URL', message: '无效的 videoId', statusCode: 400 })
  }
  const { videoId, preferredLanguage } = parsed.data

  try {
    const meta = await getVideoMeta(videoId)
    const track = selectCaptionTrack(meta.captionTracks, { preferredLanguage })
    if (!track) {
      return apiError({ code: 'NO_CAPTIONS', message: '该视频没有可用字幕', statusCode: 404 })
    }
    const cues = await fetchTranscriptCues(videoId, track.displayName)
    const segments = mergeShortCues(msCuesToSeconds(cues))
    return apiSuccess({ language: track.language, kind: track.kind, segments })
  } catch (error) {
    if (error instanceof YouTubeSourceError) {
      return apiError({ code: error.code, message: error.message, statusCode: error.statusCode })
    }
    return apiError({ code: 'EXTRACTOR_FAILED', message: '字幕抓取失败', statusCode: 502 })
  }
}

export const Route = createFileRoute('/api/youtube/captions')({
  server: { handlers: { POST: async ({ request }) => handleCaptionsPost(request) } },
})
