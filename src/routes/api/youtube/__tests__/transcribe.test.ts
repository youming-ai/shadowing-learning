import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/lib/youtube/innertube', async (importOriginal) => {
  const orig = await importOriginal<typeof import('~/lib/youtube/innertube')>()
  return { ...orig, getVideoMeta: vi.fn() }
})
vi.mock('~/lib/youtube/ytdlp', async (importOriginal) => {
  const orig = await importOriginal<typeof import('~/lib/youtube/ytdlp')>()
  return { ...orig, downloadAudio: vi.fn(), isYtdlpAvailable: vi.fn().mockResolvedValue(true) }
})
vi.mock('~/lib/ai/groq-whisper', () => ({
  processTranscription: vi.fn(),
}))

import { processTranscription } from '~/lib/ai/groq-whisper'
import { getVideoMeta } from '~/lib/youtube/innertube'
import { downloadAudio } from '~/lib/youtube/ytdlp'
import { handleYoutubeTranscribePost } from '~/routes/api/youtube/transcribe'

function post(body: unknown, ip = '203.0.113.9') {
  return new Request('http://localhost/api/youtube/transcribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

const meta = (durationSec: number) => ({
  videoId: 'dQw4w9WgXcQ',
  title: 't',
  channelName: 'c',
  thumbnailUrl: '',
  durationSec,
  isLive: false,
  captionTracks: [],
})

beforeEach(() => vi.clearAllMocks())

describe('POST /api/youtube/transcribe', () => {
  it('rejects videos longer than 30 minutes before downloading', async () => {
    vi.mocked(getVideoMeta).mockResolvedValue(meta(31 * 60))
    const res = await handleYoutubeTranscribePost(post({ videoId: 'dQw4w9WgXcQ' }))
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('VIDEO_TOO_LONG')
    expect(downloadAudio).not.toHaveBeenCalled()
  })

  it('downloads, transcribes and returns segments', async () => {
    vi.mocked(getVideoMeta).mockResolvedValue(meta(60))
    vi.mocked(downloadAudio).mockResolvedValue(new File(['x'], 'a.m4a', { type: 'audio/mp4' }))
    vi.mocked(processTranscription).mockResolvedValue({
      success: true,
      data: {
        text: 'hi',
        language: 'en',
        duration: 60,
        segments: [{ id: 1, start: 0, end: 2, text: 'hi' }],
      },
    })
    const res = await handleYoutubeTranscribePost(post({ videoId: 'dQw4w9WgXcQ', language: 'en' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.segments).toHaveLength(1)
  })
})
