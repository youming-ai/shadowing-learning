import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { apiLogger } from '~/lib/utils/logger'
import { YouTubeSourceError } from '~/lib/youtube/innertube'
import type { MsCue } from '~/lib/youtube/normalize'
import { isValidVideoId } from '~/lib/youtube/url'

const execFileAsync = promisify(execFile)

const MAX_FILESIZE = '25M' // Groq free tier 上限；dev tier 100M
const FORMAT = 'bestaudio[abr<=64]/worstaudio' // Whisper 不需要高码率；30min ≈ 11-16MB
const TIMEOUT_MS = 120_000

export async function isYtdlpAvailable(): Promise<boolean> {
  try {
    await execFileAsync('yt-dlp', ['--version'], { timeout: 10_000 })
    return true
  } catch {
    return false
  }
}

export class YtdlpError extends Error {
  constructor(
    public code: 'AUDIO_TOO_LARGE' | 'EXTRACTOR_FAILED' | 'YT_BLOCKED',
    message: string,
  ) {
    super(message)
    this.name = 'YtdlpError'
  }
}

/**
 * 下载低码率音频流并返回 File（供 Groq Whisper）。
 * videoId 必须先过 isValidVideoId（白名单字符集），execFile + '--' 双保险防注入。
 * --no-part 直写目标文件；finally 清理 tmp 前缀残留。
 */
export async function downloadAudio(videoId: string): Promise<File> {
  if (!isValidVideoId(videoId)) {
    throw new YtdlpError('EXTRACTOR_FAILED', `非法 videoId: ${videoId}`)
  }
  const tmpPath = join(tmpdir(), `yt-audio-${videoId}-${crypto.randomUUID()}.m4a`)
  try {
    await execFileAsync(
      'yt-dlp',
      ['-f', FORMAT, '--max-filesize', MAX_FILESIZE, '--no-part', '-o', tmpPath, '--', videoId],
      { timeout: TIMEOUT_MS },
    )
    const buf = await readFile(tmpPath)
    return new File([buf], `${videoId}.m4a`, { type: 'audio/mp4' })
  } catch (error) {
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
    apiLogger.error('yt-dlp failed:', { videoId, error: msg.slice(0, 300) })
    if (msg.includes('max-filesize') || msg.includes('file is larger')) {
      throw new YtdlpError('AUDIO_TOO_LARGE', '音频超过 25MB 上限')
    }
    if (msg.includes('sign in') || msg.includes('bot') || msg.includes('login')) {
      throw new YtdlpError('YT_BLOCKED', '服务器被 YouTube 风控拦截')
    }
    if (msg.includes('enoent')) {
      throw new YtdlpError('EXTRACTOR_FAILED', 'yt-dlp 不可用')
    }
    throw new YtdlpError('EXTRACTOR_FAILED', `音频下载失败: ${msg.slice(0, 200)}`)
  } finally {
    await rm(tmpPath, { force: true }).catch(() => {})
  }
}

interface Json3Event {
  tStartMs?: number
  dDurationMs?: number
  segs?: { utf8?: string }[]
}

/** Parse yt-dlp's json3 subtitle payload into MsCue[]. Pure — unit-tested. */
export function parseJson3Cues(raw: string): MsCue[] {
  const data = JSON.parse(raw) as { events?: Json3Event[] }
  const cues: MsCue[] = []
  for (const e of data.events ?? []) {
    if (!e.segs || typeof e.tStartMs !== 'number') continue
    const text = e.segs
      .map((s) => s.utf8 ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue
    cues.push({ startMs: e.tStartMs, endMs: e.tStartMs + (e.dDurationMs ?? 0), text })
  }
  return cues
}

/**
 * 从 yt-dlp 产出的文件列表中确定性地选出目标语言的 json3 文件。
 * yt-dlp 按 `<id>.<lang>.json3` 命名；优先精确语言匹配，否则回退到按字典序排序后的第一个
 * （跨文件系统稳定，避免 readdir 的 OS 顺序依赖导致选中错误轨道，例如 en vs en-orig）。
 */
export function pickSubtitleFile(
  files: string[],
  videoId: string,
  language: string,
): string | undefined {
  const json3 = files.filter((f) => f.endsWith('.json3')).sort()
  if (json3.length === 0) return undefined
  return json3.find((f) => f === `${videoId}.${language}.json3`) ?? json3[0]
}

/**
 * 抓取指定语言字幕（json3）并返回 MsCue[]。
 * 用 android_vr 等客户端绕过 timedtext 的 PoToken 封锁（youtubei.js 的 get_transcript 已 400）。
 * videoId 必须先过 isValidVideoId；execFile + '--' 双保险防注入（同 downloadAudio）。
 * 无产出 / 空字幕 → NO_CAPTIONS(404)，交给客户端 Whisper 兜底。
 */
export async function fetchSubtitleCues(
  videoId: string,
  language: string,
  kind: 'manual' | 'asr',
): Promise<MsCue[]> {
  if (!isValidVideoId(videoId)) {
    throw new YtdlpError('EXTRACTOR_FAILED', `非法 videoId: ${videoId}`)
  }
  const base = language.split('-')[0]
  const writeFlag = kind === 'asr' ? '--write-auto-subs' : '--write-subs'
  const dir = join(tmpdir(), `yt-sub-${videoId}-${crypto.randomUUID()}`)
  try {
    await mkdir(dir, { recursive: true })
    await execFileAsync(
      'yt-dlp',
      [
        '--skip-download',
        writeFlag,
        '--sub-langs',
        `${language},${base}.*,${base}`,
        '--sub-format',
        'json3',
        '-o',
        join(dir, '%(id)s.%(ext)s'),
        '--',
        videoId,
      ],
      { timeout: TIMEOUT_MS },
    )
    const chosen = pickSubtitleFile(await readdir(dir), videoId, language)
    if (!chosen) {
      throw new YouTubeSourceError('NO_CAPTIONS', '该视频没有可用字幕', 404)
    }
    const cues = parseJson3Cues(await readFile(join(dir, chosen), 'utf8'))
    if (cues.length === 0) {
      throw new YouTubeSourceError('NO_CAPTIONS', '该视频没有可用字幕', 404)
    }
    return cues
  } catch (error) {
    if (error instanceof YouTubeSourceError) throw error
    if (error instanceof YtdlpError) throw error
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
    apiLogger.error('fetchSubtitleCues failed:', { videoId, error: msg.slice(0, 300) })
    if (msg.includes('sign in') || msg.includes('bot') || msg.includes('login')) {
      throw new YtdlpError('YT_BLOCKED', '服务器被 YouTube 风控拦截')
    }
    if (msg.includes('enoent')) throw new YtdlpError('EXTRACTOR_FAILED', 'yt-dlp 不可用')
    throw new YtdlpError('EXTRACTOR_FAILED', `字幕抓取失败: ${msg.slice(0, 200)}`)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
