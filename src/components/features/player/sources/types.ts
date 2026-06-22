export type AdapterEvent = 'ready' | 'play' | 'pause' | 'ended' | 'timeupdate' | 'error'

export interface MediaSourceAdapter {
  mount(container: HTMLElement): Promise<void>
  destroy(): void
  play(): Promise<void>
  pause(): void
  seekTo(seconds: number): void
  setPlaybackRate(rate: number): void
  getAvailablePlaybackRates(): number[]
  setVolume(volume: number): void // 0-1
  getCurrentTime(): number
  getDuration(): number
  on(event: AdapterEvent, cb: (payload?: unknown) => void): () => void
}

/** 极简事件分发基类，两个 adapter 共用 */
export class AdapterEmitter {
  private listeners = new Map<AdapterEvent, Set<(payload?: unknown) => void>>()

  on(event: AdapterEvent, cb: (payload?: unknown) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)?.add(cb)
    return () => this.listeners.get(event)?.delete(cb)
  }

  protected emit(event: AdapterEvent, payload?: unknown): void {
    for (const cb of this.listeners.get(event) ?? []) cb(payload)
  }

  protected clearListeners(): void {
    this.listeners.clear()
  }
}
