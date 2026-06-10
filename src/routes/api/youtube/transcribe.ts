import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { processTranscription } from '~/lib/ai/groq-whisper'
import { apiError, apiSuccess } from '~/lib/utils/api-response'
import { createDailyQuota, createSemaphore } from '~/lib/utils/global-limits'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitConfig,
  getRateLimitHeaders,
} from '~/lib/utils/rate-limiter'
import { getVideoMeta, YouTubeSourceError } from '~/lib/youtube/innertube'
import { isValidVideoId } from '~/lib/youtube/url'
import { downloadAudio, isYtdlpAvailable, YtdlpError } from '~/lib/youtube/ytdlp'

const MAX_DURATION_SEC = 30 * 60
const transcribeSemaphore = createSemaphore(1) // 同时最多 1 个 yt-dlp+Whisper 任务
const transcribeDailyQuota = createDailyQuota(24) // 每日全局 24 次（UTC 日界）

const bodySchema = z.object({
  videoId: z.string(),
  language: z.string().optional().default('auto'),
})

export async function handleYoutubeTranscribePost(request: Request): Promise<Response> {
  const clientId = getClientIdentifier(request)
  const config = getRateLimitConfig('/api/youtube/transcribe')
  const limit = checkRateLimit(`yt-transcribe:${clientId}`, config)
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
  const { videoId, language } = parsed.data

  if (!(await isYtdlpAvailable())) {
    return apiError({
      code: 'EXTRACTOR_UNAVAILABLE',
      message: '服务器未安装 yt-dlp，无法转写无字幕视频',
      statusCode: 501,
    })
  }
  if (!transcribeDailyQuota.tryConsume()) {
    return apiError({
      code: 'QUOTA_EXHAUSTED',
      message: '今日 AI 转写额度已用完，请明天再试或选择有字幕的视频',
      statusCode: 429,
    })
  }
  const release = transcribeSemaphore.tryAcquire()
  if (!release) {
    return apiError({
      code: 'SERVER_BUSY',
      message: '已有转写任务进行中，请稍后再试',
      statusCode: 429,
    })
  }

  try {
    const meta = await getVideoMeta(videoId)
    if (meta.durationSec > MAX_DURATION_SEC) {
      return apiError({
        code: 'VIDEO_TOO_LONG',
        message: '无字幕视频暂只支持 30 分钟以内',
        statusCode: 422,
      })
    }
    const audioFile = await downloadAudio(videoId)
    const result = await processTranscription(audioFile, language)
    if (!result.success) {
      return result.error
    }
    return apiSuccess({
      status: 'completed',
      text: result.data.text,
      language: result.data.language ?? language,
      duration: result.data.duration,
      segments: result.data.segments,
    })
  } catch (error) {
    if (error instanceof YouTubeSourceError) {
      return apiError({ code: error.code, message: error.message, statusCode: error.statusCode })
    }
    if (error instanceof YtdlpError) {
      const statusCode = error.code === 'AUDIO_TOO_LARGE' ? 422 : 502
      return apiError({ code: error.code, message: error.message, statusCode })
    }
    return apiError({ code: 'EXTRACTOR_FAILED', message: '转写失败', statusCode: 502 })
  } finally {
    release()
  }
}

export const Route = createFileRoute('/api/youtube/transcribe')({
  server: { handlers: { POST: async ({ request }) => handleYoutubeTranscribePost(request) } },
})
