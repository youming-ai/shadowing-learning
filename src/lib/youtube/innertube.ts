import { Innertube } from 'youtubei.js'
import { apiLogger } from '~/lib/utils/logger'
import type { CaptionTrackMeta } from '~/lib/youtube/track-select'

export type YouTubeErrorCode =
  | 'VIDEO_NOT_FOUND'
  | 'VIDEO_UNAVAILABLE'
  | 'LIVE_NOT_SUPPORTED'
  | 'NO_CAPTIONS'
  | 'YT_BLOCKED'
  | 'EXTRACTOR_FAILED'

export class YouTubeSourceError extends Error {
  constructor(
    public code: YouTubeErrorCode,
    message: string,
    public statusCode: number,
  ) {
    super(message)
    this.name = 'YouTubeSourceError'
  }
}

/** 把 youtubei.js 抛出的错误归类到我们的错误码。拿不准一律 EXTRACTOR_FAILED（可重试）。 */
export function classifyYouTubeError(error: unknown): YouTubeSourceError {
  if (error instanceof YouTubeSourceError) return error
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (
    msg.includes('sign in') ||
    msg.includes('log in') ||
    msg.includes('login') ||
    msg.includes('bot')
  ) {
    return new YouTubeSourceError('YT_BLOCKED', '服务器被 YouTube 风控拦截', 502)
  }
  if (
    msg.includes('private') ||
    msg.includes('age') ||
    msg.includes('region') ||
    msg.includes('unavailable')
  ) {
    return new YouTubeSourceError('VIDEO_UNAVAILABLE', '视频不可用（私享/区域/年龄限制）', 403)
  }
  if (msg.includes('not found') || msg.includes('404') || msg.includes('deleted')) {
    return new YouTubeSourceError('VIDEO_NOT_FOUND', '视频不存在或已删除', 404)
  }
  return new YouTubeSourceError(
    'EXTRACTOR_FAILED',
    `YouTube 数据抽取失败: ${msg.slice(0, 200)}`,
    502,
  )
}

let innertubePromise: Promise<Innertube> | null = null
function getClient(): Promise<Innertube> {
  if (!innertubePromise) {
    innertubePromise = Innertube.create()
  }
  return innertubePromise
}

export interface VideoMeta {
  videoId: string
  title: string
  channelName: string
  thumbnailUrl: string
  durationSec: number
  isLive: boolean
  captionTracks: CaptionTrackMeta[]
}

// biome-ignore lint/suspicious/noExplicitAny: youtubei.js 的响应类型在版本间漂移，按运行时形状读取
function mapCaptionTracks(info: any): CaptionTrackMeta[] {
  // Verified v17.0.1: info.captions is PlayerCaptionsTracklist; caption_tracks is CaptionTrackData[]
  // CaptionTrackData: { language_code: string; kind?: 'asr' | 'frc'; name: Text }
  // Text.text is the plain string; kind 'frc' (forced) maps to 'manual' — intentional.
  const tracks = info?.captions?.caption_tracks ?? []
  // biome-ignore lint/suspicious/noExplicitAny: 同上
  return tracks.map((t: any) => ({
    language: String(t.language_code ?? ''),
    kind: t.kind === 'asr' ? ('asr' as const) : ('manual' as const),
    // Text object: use .text (string | undefined) with toString() fallback
    displayName: String(t.name?.text ?? t.name?.toString?.() ?? t.name ?? ''),
  }))
}

/** resolve 用：轻请求（player 响应），含 caption 轨元数据 */
export async function getVideoMeta(videoId: string): Promise<VideoMeta> {
  try {
    const yt = await getClient()
    const info = await yt.getBasicInfo(videoId)
    const basic = info.basic_info
    if (!basic?.id) {
      throw new YouTubeSourceError('VIDEO_NOT_FOUND', '视频不存在', 404)
    }
    return {
      videoId,
      title: basic.title ?? '',
      // Verified v17.0.1: channel is { id, name, url } | null
      channelName: basic.channel?.name ?? '',
      // Verified v17.0.1: thumbnail is Thumbnail[] | undefined; Thumbnail has .url: string
      thumbnailUrl: basic.thumbnail?.[0]?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      // Verified v17.0.1: duration is number | undefined
      durationSec: basic.duration ?? 0,
      // Verified v17.0.1: is_live is boolean | undefined
      isLive: Boolean(basic.is_live),
      captionTracks: mapCaptionTracks(info),
    }
  } catch (error) {
    apiLogger.error('getVideoMeta failed:', { videoId, error: String(error) })
    throw classifyYouTubeError(error)
  }
}
