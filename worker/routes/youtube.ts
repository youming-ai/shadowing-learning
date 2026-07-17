import { Hono } from "hono"
import z from "zod"
import type { Env } from "../lib/types"
import { apiError, apiSuccess } from "../lib/api-response"
import { Innertube } from "youtubei.js"
import { fetchTimedtextSubtitles, mergeShortCues, msCuesToSeconds } from "../lib/youtube-captions"

export const youtubeRoute = new Hono<{ Bindings: Env }>()

let _yt: Innertube | null = null

async function getInnertube(): Promise<Innertube> {
  if (!_yt) {
    _yt = await Innertube.create()
  }
  return _yt
}

interface CaptionTrackMeta {
  language: string
  kind: "asr" | "manual"
  displayName: string
  baseUrl: string
}

interface VideoMeta {
  videoId: string
  title: string
  channelName: string
  thumbnailUrl: string
  durationSec: number
  isLive: boolean
  captionTracks: CaptionTrackMeta[]
}

function selectCaptionTrack(
  tracks: CaptionTrackMeta[],
  opts?: { preferredLanguage?: string },
): CaptionTrackMeta | undefined {
  if (tracks.length === 0) return undefined
  if (opts?.preferredLanguage) {
    const exact = tracks.find((t) => t.language === opts.preferredLanguage)
    if (exact) return exact
    const prefix = opts.preferredLanguage.split("-")[0]
    const match = tracks.find((t) => t.language.startsWith(prefix))
    if (match) return match
  }
  return tracks[0]
}

function getVideoMeta(videoId: string): Promise<VideoMeta> {
  return getInnertube().then(async (yt) => {
    const info = await yt.getBasicInfo(videoId)
    const basic = info.basic_info
    if (!basic?.id) {
      throw Object.assign(new Error("视频不存在"), { code: "VIDEO_NOT_FOUND", statusCode: 404 })
    }
    const captionTracks: CaptionTrackMeta[] = (
      (
        info as unknown as {
          captions?: {
            caption_tracks?: Array<{
              language_code: string
              kind?: string
              name?: { text?: string }
              base_url: string
            }>
          }
        }
      ).captions?.caption_tracks ?? []
    ).map((t) => ({
      language: String(t.language_code ?? ""),
      kind: t.kind === "asr" ? ("asr" as const) : ("manual" as const),
      displayName: String(t.name?.text ?? ""),
      baseUrl: t.base_url,
    }))

    return {
      videoId,
      title: basic.title ?? "",
      channelName: (basic.channel as { name?: string } | null)?.name ?? "",
      thumbnailUrl: (basic.thumbnail?.[0] as { url?: string } | undefined)?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      durationSec: basic.duration ?? 0,
      isLive: Boolean(basic.is_live),
      captionTracks,
    }
  })
}

function extractVideoId(input: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input
  try {
    const url = new URL(input)
    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v")
    }
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1)
    }
  } catch {
    // pass
  }
  return null
}

const resolveBody = z.object({ url: z.string().min(1).max(2048) })
const captionsBody = z.object({
  videoId: z.string(),
  preferredLanguage: z.string().optional(),
})

youtubeRoute.post("/resolve", async (c) => {
  try {
    const body = await c.req.json().catch(() => null)
    const parsed = resolveBody.safeParse(body)
    if (!parsed.success) {
      return apiError({ code: "INVALID_URL", message: "请求体无效", statusCode: 400 })
    }

    const videoId = extractVideoId(parsed.data.url)
    if (!videoId) {
      return apiError({ code: "INVALID_URL", message: "无法识别的 YouTube 链接", statusCode: 400 })
    }

    const meta = await getVideoMeta(videoId)
    if (meta.isLive) {
      return apiError({ code: "LIVE_NOT_SUPPORTED", message: "暂不支持直播内容", statusCode: 422 })
    }
    return apiSuccess(meta)
  } catch (error) {
    const e = error as Error & { code?: string; statusCode?: number }
    if (e.code) {
      return apiError({ code: e.code, message: e.message, statusCode: e.statusCode || 502 })
    }
    return apiError({ code: "EXTRACTOR_FAILED", message: "YouTube 解析失败", statusCode: 502 })
  }
})

youtubeRoute.post("/captions", async (c) => {
  try {
    const body = await c.req.json().catch(() => null)
    const parsed = captionsBody.safeParse(body)
    if (!parsed.success || !/^[a-zA-Z0-9_-]{11}$/.test(parsed.data.videoId)) {
      return apiError({ code: "INVALID_URL", message: "无效的 videoId", statusCode: 400 })
    }

    const { videoId, preferredLanguage } = parsed.data

    const meta = await getVideoMeta(videoId)
    const track = selectCaptionTrack(meta.captionTracks, { preferredLanguage })
    if (!track) {
      return apiError({ code: "NO_CAPTIONS", message: "该视频没有可用字幕", statusCode: 404 })
    }

    const cues = await fetchTimedtextSubtitles(track.baseUrl)
    const segments = mergeShortCues(msCuesToSeconds(cues))

    return apiSuccess({ language: track.language, kind: track.kind, segments })
  } catch (error) {
    const e = error as Error
    if (e.message === "NO_CAPTIONS") {
      return apiError({ code: "NO_CAPTIONS", message: "该视频没有可用字幕", statusCode: 404 })
    }
    return apiError({ code: "EXTRACTOR_FAILED", message: `字幕抓取失败: ${e.message}`, statusCode: 502 })
  }
})
