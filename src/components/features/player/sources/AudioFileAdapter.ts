import type { MediaRow } from '~/types/db/database'
import { AdapterEmitter, type MediaSourceAdapter } from './types'

const AUDIO_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

/**
 * 本地音频适配器。objectURL 的创建/撤销在此内聚（原 usePlayerDataQuery 的职责）。
 * currentTime 单向流出（timeupdate），seek 只经 seekTo()。
 */
export class AudioFileAdapter extends AdapterEmitter implements MediaSourceAdapter {
  private audio: HTMLAudioElement | null = null
  private objectUrl: string | null = null
  private detach: (() => void) | null = null

  constructor(private media: MediaRow) {
    super()
  }

  async mount(container: HTMLElement): Promise<void> {
    if (!this.media.blob) {
      throw new Error('Audio media has no blob')
    }
    const audio = document.createElement('audio')
    audio.preload = 'auto'
    this.objectUrl = URL.createObjectURL(this.media.blob)
    audio.src = this.objectUrl
    container.appendChild(audio)
    this.audio = audio

    const onTime = () => this.emit('timeupdate', audio.currentTime)
    const onPlay = () => this.emit('play')
    const onPause = () => this.emit('pause')
    const onEnded = () => this.emit('ended')
    const onError = () => this.emit('error', audio.error)
    const onLoaded = () => this.emit('ready')
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('loadedmetadata', onLoaded)
    this.detach = () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('loadedmetadata', onLoaded)
    }
  }

  destroy(): void {
    this.detach?.()
    this.audio?.pause()
    this.audio?.remove()
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
    this.audio = null
    this.clearListeners()
  }

  async play(): Promise<void> {
    await this.audio?.play()
  }

  pause(): void {
    this.audio?.pause()
  }

  seekTo(seconds: number): void {
    if (this.audio) this.audio.currentTime = seconds
  }

  setPlaybackRate(rate: number): void {
    if (this.audio) this.audio.playbackRate = rate
  }

  getAvailablePlaybackRates(): number[] {
    return AUDIO_RATES
  }

  setVolume(volume: number): void {
    if (this.audio) this.audio.volume = volume
  }

  getCurrentTime(): number {
    return this.audio?.currentTime ?? 0
  }

  getDuration(): number {
    const d = this.audio?.duration
    return Number.isFinite(d) ? (d as number) : (this.media.durationSec ?? 0)
  }
}
