import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaImport } from '~/hooks/media/useMediaImport'
import { DBUtils, db } from '~/lib/db/db'

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const META = {
  videoId: 'dQw4w9WgXcQ',
  title: 'T',
  channelName: 'C',
  thumbnailUrl: 'https://i.ytimg.com/x.jpg',
  durationSec: 212,
  isLive: false,
  captionTracks: [],
}

beforeEach(async () => {
  await db.segments.clear()
  await db.subtitles.clear()
  await db.media.clear()
  vi.restoreAllMocks()
})

describe('useMediaImport', () => {
  it('resolve → save → returns new mediaId', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: META }), { status: 200 }),
    )
    const { result } = renderHook(() => useMediaImport(), { wrapper })
    let mediaId = 0
    await act(async () => {
      mediaId = await result.current.importYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')
    })
    const media = await DBUtils.getMedia(mediaId)
    expect(media).toMatchObject({ kind: 'youtube', externalId: 'dQw4w9WgXcQ', title: 'T' })
  })

  it('duplicate import returns the existing mediaId without a second row', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ success: true, data: META }), { status: 200 })),
    )
    const { result } = renderHook(() => useMediaImport(), { wrapper })
    let first = 0
    let second = 0
    await act(async () => {
      first = await result.current.importYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')
    })
    await act(async () => {
      second = await result.current.importYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')
    })
    expect(second).toBe(first)
    expect(await db.media.count()).toBe(1)
  })

  it('surfaces the server error code on failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: { code: 'VIDEO_UNAVAILABLE', message: 'x' } }),
        { status: 403 },
      ),
    )
    const { result } = renderHook(() => useMediaImport(), { wrapper })
    await act(async () => {
      await expect(
        result.current.importYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'),
      ).rejects.toMatchObject({
        code: 'VIDEO_UNAVAILABLE',
      })
    })
    await waitFor(() => expect(result.current.stage).toBe('idle'))
  })
})
