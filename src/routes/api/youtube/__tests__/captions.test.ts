import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/lib/youtube/innertube', async (importOriginal) => {
  const orig = await importOriginal<typeof import('~/lib/youtube/innertube')>()
  return { ...orig, getVideoMeta: vi.fn() }
})

vi.mock('~/lib/youtube/ytdlp', async (importOriginal) => {
  const orig = await importOriginal<typeof import('~/lib/youtube/ytdlp')>()
  return { ...orig, fetchSubtitleCues: vi.fn(), isYtdlpAvailable: vi.fn() }
})

import { getVideoMeta, YouTubeSourceError } from '~/lib/youtube/innertube'
import { fetchSubtitleCues, isYtdlpAvailable } from '~/lib/youtube/ytdlp'
import { handleCaptionsPost } from '~/routes/api/youtube/captions'

function post(body: unknown) {
  return new Request('http://localhost/api/youtube/captions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.8' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isYtdlpAvailable).mockResolvedValue(true)
})

describe('POST /api/youtube/captions', () => {
  it('selects track, fetches transcript, returns merged second-based segments', async () => {
    vi.mocked(getVideoMeta).mockResolvedValue({
      videoId: 'dQw4w9WgXcQ',
      title: 't',
      channelName: 'c',
      thumbnailUrl: '',
      durationSec: 100,
      isLive: false,
      captionTracks: [
        { language: 'en', kind: 'manual', displayName: 'English' },
        { language: 'en', kind: 'asr', displayName: 'English (auto-generated)' },
      ],
    })
    vi.mocked(fetchSubtitleCues).mockResolvedValue([
      { startMs: 0, endMs: 800, text: 'I was' },
      { startMs: 800, endMs: 3000, text: 'told to make my bed.' },
    ])
    const res = await handleCaptionsPost(post({ videoId: 'dQw4w9WgXcQ', preferredLanguage: 'en' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.language).toBe('en')
    expect(json.data.kind).toBe('manual')
    expect(json.data.segments).toEqual([{ start: 0, end: 3, text: 'I was told to make my bed.' }])
    expect(fetchSubtitleCues).toHaveBeenCalledWith('dQw4w9WgXcQ', 'en', 'manual')
  })

  it('returns NO_CAPTIONS 404 when no tracks exist', async () => {
    vi.mocked(getVideoMeta).mockResolvedValue({
      videoId: 'dQw4w9WgXcQ',
      title: 't',
      channelName: 'c',
      thumbnailUrl: '',
      durationSec: 100,
      isLive: false,
      captionTracks: [],
    })
    const res = await handleCaptionsPost(post({ videoId: 'dQw4w9WgXcQ' }))
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_CAPTIONS')
  })

  it('rejects malformed videoId', async () => {
    const res = await handleCaptionsPost(post({ videoId: 'nope' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_URL')
  })

  it('returns EXTRACTOR_UNAVAILABLE 501 when yt-dlp is missing', async () => {
    vi.mocked(isYtdlpAvailable).mockResolvedValue(false)
    const res = await handleCaptionsPost(post({ videoId: 'dQw4w9WgXcQ' }))
    expect(res.status).toBe(501)
    expect((await res.json()).error.code).toBe('EXTRACTOR_UNAVAILABLE')
  })

  it('maps YouTubeSourceError through (e.g. YT_BLOCKED)', async () => {
    vi.mocked(getVideoMeta).mockRejectedValue(new YouTubeSourceError('YT_BLOCKED', 'blocked', 502))
    const res = await handleCaptionsPost(post({ videoId: 'dQw4w9WgXcQ' }))
    expect(res.status).toBe(502)
    expect((await res.json()).error.code).toBe('YT_BLOCKED')
  })
})
