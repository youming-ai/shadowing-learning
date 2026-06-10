import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { apiError, apiSuccess } from '~/lib/utils/api-response'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitConfig,
  getRateLimitHeaders,
} from '~/lib/utils/rate-limiter'
import { getVideoMeta, YouTubeSourceError } from '~/lib/youtube/innertube'
import { extractVideoId } from '~/lib/youtube/url'

const bodySchema = z.object({ url: z.string().min(1).max(2048) })

export async function handleResolvePost(request: Request): Promise<Response> {
  const clientId = getClientIdentifier(request)
  const config = getRateLimitConfig('/api/youtube/resolve')
  const limit = checkRateLimit(`yt-resolve:${clientId}`, config)
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
  if (!parsed.success) {
    return apiError({ code: 'INVALID_URL', message: '请求体无效', statusCode: 400 })
  }

  const videoId = extractVideoId(parsed.data.url)
  if (!videoId) {
    return apiError({ code: 'INVALID_URL', message: '无法识别的 YouTube 链接', statusCode: 400 })
  }

  try {
    const meta = await getVideoMeta(videoId)
    if (meta.isLive) {
      return apiError({ code: 'LIVE_NOT_SUPPORTED', message: '暂不支持直播内容', statusCode: 422 })
    }
    return apiSuccess(meta)
  } catch (error) {
    if (error instanceof YouTubeSourceError) {
      return apiError({ code: error.code, message: error.message, statusCode: error.statusCode })
    }
    return apiError({ code: 'EXTRACTOR_FAILED', message: 'YouTube 解析失败', statusCode: 502 })
  }
}

export const Route = createFileRoute('/api/youtube/resolve')({
  server: { handlers: { POST: async ({ request }) => handleResolvePost(request) } },
})
