import { execFile } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { apiLogger } from '~/lib/utils/logger'
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
