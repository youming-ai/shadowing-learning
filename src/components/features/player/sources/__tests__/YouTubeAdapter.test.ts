import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetIframeApiForTest } from '~/components/features/player/sources/iframe-loader'
import { YouTubeAdapter } from '~/components/features/player/sources/YouTubeAdapter'
import type { MediaRow } from '~/types/db/database'

const media: MediaRow = {
  id: 2,
  kind: 'youtube',
  title: 'v',
  durationSec: 212,
  addedAt: new Date(),
  updatedAt: new Date(),
  externalId: 'dQw4w9WgXcQ',
}

type StateCb = (e: { data: number }) => void
let stateCb: StateCb | undefined
let errorCb: StateCb | undefined
const playerMock = {
  playVideo: vi.fn(),
  pauseVideo: vi.fn(),
  seekTo: vi.fn(),
  setPlaybackRate: vi.fn(),
  getAvailablePlaybackRates: vi.fn().mockReturnValue([0.5, 1, 1.5]),
  setVolume: vi.fn(),
  getCurrentTime: vi.fn().mockReturnValue(7),
  getDuration: vi.fn().mockReturnValue(212),
  destroy: vi.fn(),
}

beforeEach(() => {
  vi.useFakeTimers()
  resetIframeApiForTest()
  // 真实 class 构造器（不是 vi.fn）：production 用 `new YT.Player(...)`。
  // 把 playerMock 的方法挂到实例上（同一组 vi.fn 引用），使 new 出来的 player 行为等同 playerMock。
  class MockPlayer {
    constructor(_el: unknown, opts: { events?: Record<string, (e?: unknown) => void> }) {
      stateCb = opts.events?.onStateChange as StateCb | undefined
      errorCb = opts.events?.onError as StateCb | undefined
      queueMicrotask(() => opts.events?.onReady?.())
      Object.assign(this, playerMock)
    }
  }
  window.YT = {
    PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0, BUFFERING: 3 },
    Player: MockPlayer,
  } as unknown as typeof window.YT
})

afterEach(() => {
  vi.useRealTimers()
  window.YT = undefined
})

describe('YouTubeAdapter', () => {
  async function mountAdapter() {
    const adapter = new YouTubeAdapter(media)
    await adapter.mount(document.createElement('div'))
    return adapter
  }

  it('maps PLAYING/PAUSED/ENDED state changes to adapter events', async () => {
    const adapter = await mountAdapter()
    const onPlay = vi.fn()
    const onPause = vi.fn()
    const onEnded = vi.fn()
    adapter.on('play', onPlay)
    adapter.on('pause', onPause)
    adapter.on('ended', onEnded)
    stateCb?.({ data: 1 })
    stateCb?.({ data: 2 })
    stateCb?.({ data: 0 })
    expect(onPlay).toHaveBeenCalled()
    expect(onPause).toHaveBeenCalled()
    expect(onEnded).toHaveBeenCalled()
  })

  it('polls timeupdate at 250ms only while playing', async () => {
    const adapter = await mountAdapter()
    const onTime = vi.fn()
    adapter.on('timeupdate', onTime)
    vi.advanceTimersByTime(1000)
    expect(onTime).not.toHaveBeenCalled()
    stateCb?.({ data: 1 })
    vi.advanceTimersByTime(1000)
    expect(onTime.mock.calls.length).toBeGreaterThanOrEqual(3)
    stateCb?.({ data: 2 })
    onTime.mockClear()
    vi.advanceTimersByTime(1000)
    expect(onTime).not.toHaveBeenCalled()
  })

  it('maps embed-blocked error codes 101/150 to EMBED_BLOCKED', async () => {
    const adapter = await mountAdapter()
    const onError = vi.fn()
    adapter.on('error', onError)
    errorCb?.({ data: 101 })
    expect(onError).toHaveBeenCalledWith({ code: 'EMBED_BLOCKED' })
  })

  it('destroy clears polling and the player', async () => {
    const adapter = await mountAdapter()
    stateCb?.({ data: 1 })
    adapter.destroy()
    expect(playerMock.destroy).toHaveBeenCalled()
    const onTime = vi.fn()
    adapter.on('timeupdate', onTime)
    vi.advanceTimersByTime(1000)
    expect(onTime).not.toHaveBeenCalled()
  })
})
