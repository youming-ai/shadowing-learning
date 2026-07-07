import { createFileRoute } from '@tanstack/react-router'
// 默认导入（非 `{ z }`）：vitest 的 ESM interop 下 zod v4 的具名导出 `z` 解析为 undefined，
// 默认导入在 vitest 与生产运行时（zod v4 有 `export default z`）下都可用。勿改回具名导入。
import z from 'zod'
import { apiError, apiSuccess } from '~/lib/utils/api-response'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitConfig,
  getRateLimitHeaders,
} from '~/lib/utils/rate-limiter'
import { getVideoMeta, YouTubeSourceError } from '~/lib/youtube/innertube'
import { mergeShortCues, msCuesToSeconds } from '~/lib/youtube/normalize'
import { selectCaptionTrack } from '~/lib/youtube/track-select'
import { isValidVideoId } from '~/lib/youtube/url'
import { fetchSubtitleCues, isYtdlpAvailable, YtdlpError } from '~/lib/youtube/ytdlp'

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

  if (!(await isYtdlpAvailable())) {
    return apiError({
      code: 'EXTRACTOR_UNAVAILABLE',
      message: '服务器未安装 yt-dlp，无法抓取字幕',
      statusCode: 501,
    })
  }

  try {
    const meta = await getVideoMeta(videoId)
    const track = selectCaptionTrack(meta.captionTracks, { preferredLanguage })
    if (!track) {
      return apiError({ code: 'NO_CAPTIONS', message: '该视频没有可用字幕', statusCode: 404 })
    }
    const cues = await fetchSubtitleCues(videoId, track.language, track.kind)
    const segments = mergeShortCues(msCuesToSeconds(cues))
    return apiSuccess({ language: track.language, kind: track.kind, segments })
  } catch (error) {
    if (error instanceof YouTubeSourceError) {
      return apiError({ code: error.code, message: error.message, statusCode: error.statusCode })
    }
    if (error instanceof YtdlpError) {
      return apiError({ code: error.code, message: error.message, statusCode: 502 })
    }
    return apiError({ code: 'EXTRACTOR_FAILED', message: '字幕抓取失败', statusCode: 502 })
  }
}

export const Route = createFileRoute('/api/youtube/captions')({
  server: { handlers: { POST: async ({ request }) => handleCaptionsPost(request) } },
})
