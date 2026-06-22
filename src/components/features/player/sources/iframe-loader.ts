/** YouTube IFrame Player API 的最小类型（不引第三方 @types，按官方文档手写） */
export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setPlaybackRate(rate: number): void
  getAvailablePlaybackRates(): number[]
  setVolume(volume: number): void // 0-100
  getCurrentTime(): number
  getDuration(): number
  destroy(): void
}

export interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      host?: string
      playerVars?: Record<string, number | string>
      events?: {
        onReady?: () => void
        onStateChange?: (e: { data: number }) => void
        onError?: (e: { data: number }) => void
      }
    },
  ) => YTPlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null

/** 全局只注入一次 iframe_api 脚本；处理 onYouTubeIframeAPIReady 回调竞态 */
export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      if (window.YT) resolve(window.YT)
      else reject(new Error('YT namespace missing after API ready'))
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      apiPromise = null
      reject(new Error('Failed to load YouTube iframe API'))
    }
    document.head.appendChild(script)
  })
  return apiPromise
}

/** 仅供测试重置单例 */
export function resetIframeApiForTest(): void {
  apiPromise = null
}
