import type { MediaRow } from '~/types/db/database'
import { loadYouTubeIframeApi, type YTPlayer } from './iframe-loader'
import { AdapterEmitter, type MediaSourceAdapter } from './types'

const POLL_MS = 250 // 归一 ~4Hz，与 <audio> 原生 timeupdate 节奏一致

export class YouTubeAdapter extends AdapterEmitter implements MediaSourceAdapter {
  private player: YTPlayer | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private destroyed = false

  constructor(private media: MediaRow) {
    super()
  }

  async mount(container: HTMLElement): Promise<void> {
    if (!this.media.externalId) {
      throw new Error('YouTube media has no externalId')
    }
    const YT = await loadYouTubeIframeApi()
    if (this.destroyed) return
    await new Promise<void>((resolve, reject) => {
      // 真实 YouTube IFrame API 要求 `new YT.Player(...)`（构造函数用法）。
      // 测试侧的 mock 用真正的 class 构造器（见 YouTubeAdapter.test.ts），所以这里保持 `new`。
      this.player = new YT.Player(container, {
        videoId: this.media.externalId as string,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { controls: 0, rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            this.emit('ready')
            resolve()
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.PLAYING) {
              this.startPolling()
              this.emit('play')
            } else if (e.data === YT.PlayerState.PAUSED) {
              this.stopPolling()
              this.emit('pause')
            } else if (e.data === YT.PlayerState.ENDED) {
              this.stopPolling()
              this.emit('ended')
            }
          },
          onError: (e: { data: number }) => {
            // onReady 之后到达的 error（如播放中失败）不该让已经 settle 过的 mount() 再变化 ——
            // reject 在 promise 已 resolve 后是安全的 no-op。mount() 本身只需在"从未 ready"时兜底 settle。
            if (e.data === 101 || e.data === 150) {
              this.emit('error', { code: 'EMBED_BLOCKED' })
            } else {
              this.emit('error', { code: 'PLAYBACK_ERROR', raw: e.data })
            }
            reject(new Error(`YouTube player error: ${e.data}`))
          },
        },
      })
    })
  }

  private startPolling(): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => {
      this.emit('timeupdate', this.player?.getCurrentTime() ?? 0)
    }, POLL_MS)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  destroy(): void {
    this.destroyed = true
    this.stopPolling()
    this.player?.destroy()
    this.player = null
    this.clearListeners()
  }

  async play(): Promise<void> {
    this.player?.playVideo()
  }

  pause(): void {
    this.player?.pauseVideo()
  }

  seekTo(seconds: number): void {
    this.player?.seekTo(seconds, true)
  }

  setPlaybackRate(rate: number): void {
    this.player?.setPlaybackRate(rate)
  }

  getAvailablePlaybackRates(): number[] {
    return this.player?.getAvailablePlaybackRates() ?? [1]
  }

  setVolume(volume: number): void {
    this.player?.setVolume(Math.round(volume * 100))
  }

  getCurrentTime(): number {
    return this.player?.getCurrentTime() ?? 0
  }

  getDuration(): number {
    const d = this.player?.getDuration()
    return d && d > 0 ? d : (this.media.durationSec ?? 0)
  }
}
