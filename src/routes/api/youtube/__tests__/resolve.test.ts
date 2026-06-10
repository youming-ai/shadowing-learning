import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/lib/youtube/innertube', () => ({
  getVideoMeta: vi.fn(),
  YouTubeSourceError: class extends Error {
    constructor(
      public code: string,
      message: string,
      public statusCode: number,
    ) {
      super(message)
    }
  },
  classifyYouTubeError: vi.fn(),
}))

import { getVideoMeta, YouTubeSourceError } from '~/lib/youtube/innertube'
import { handleResolvePost } from '~/routes/api/youtube/resolve'

function post(body: unknown) {
  return new Request('http://localhost/api/youtube/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/youtube/resolve', () => {
  it('returns video meta for a valid URL', async () => {
    vi.mocked(getVideoMeta).mockResolvedValue({
      videoId: 'dQw4w9WgXcQ',
      title: 'T',
      channelName: 'C',
      thumbnailUrl: 'https://i.ytimg.com/x.jpg',
      durationSec: 212,
      isLive: false,
      captionTracks: [{ language: 'en', kind: 'manual', displayName: 'English' }],
    })
    const res = await handleResolvePost(post({ url: 'https://youtu.be/dQw4w9WgXcQ' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.videoId).toBe('dQw4w9WgXcQ')
    expect(json.data.captionTracks).toHaveLength(1)
  })

  it('rejects an invalid URL with INVALID_URL', async () => {
    const res = await handleResolvePost(post({ url: 'https://example.com/watch?v=dQw4w9WgXcQ' }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error.code).toBe('INVALID_URL')
    expect(getVideoMeta).not.toHaveBeenCalled()
  })

  it('rejects live streams with LIVE_NOT_SUPPORTED', async () => {
    vi.mocked(getVideoMeta).mockResolvedValue({
      videoId: 'dQw4w9WgXcQ',
      title: 'live',
      channelName: 'C',
      thumbnailUrl: '',
      durationSec: 0,
      isLive: true,
      captionTracks: [],
    })
    const res = await handleResolvePost(post({ url: 'https://youtu.be/dQw4w9WgXcQ' }))
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('LIVE_NOT_SUPPORTED')
  })

  it('maps a YouTubeSourceError through to its code/status (e.g. VIDEO_UNAVAILABLE)', async () => {
    vi.mocked(getVideoMeta).mockRejectedValue(
      new YouTubeSourceError('VIDEO_UNAVAILABLE', 'private video', 403),
    )
    const res = await handleResolvePost(post({ url: 'https://youtu.be/dQw4w9WgXcQ' }))
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('VIDEO_UNAVAILABLE')
  })

  it('maps an unknown error to EXTRACTOR_FAILED 502', async () => {
    vi.mocked(getVideoMeta).mockRejectedValue(new Error('boom'))
    const res = await handleResolvePost(post({ url: 'https://youtu.be/dQw4w9WgXcQ' }))
    expect(res.status).toBe(502)
    expect((await res.json()).error.code).toBe('EXTRACTOR_FAILED')
  })
})
