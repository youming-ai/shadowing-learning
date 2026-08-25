import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioFileAdapter } from '~/components/features/player/sources/AudioFileAdapter'
import type { MediaRow } from '~/types/db/database'

const media: MediaRow = {
  id: 1,
  kind: 'audio',
  title: 'a.mp3',
  durationSec: 60,
  addedAt: new Date(),
  updatedAt: new Date(),
  blob: new Blob(['x'], { type: 'audio/mpeg' }),
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

describe('AudioFileAdapter', () => {
  it('mounts an <audio> with an object URL and revokes it on destroy', async () => {
    const adapter = new AudioFileAdapter(media)
    const container = document.createElement('div')
    await adapter.mount(container)
    const audio = container.querySelector('audio')
    expect(audio?.src).toContain('blob:mock-url')
    adapter.destroy()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    expect(container.querySelector('audio')).toBeNull()
  })

  it('forwards native events as adapter events', async () => {
    const adapter = new AudioFileAdapter(media)
    const container = document.createElement('div')
    await adapter.mount(container)
    const audio = container.querySelector('audio') as HTMLAudioElement
    const onPlay = vi.fn()
    const onTime = vi.fn()
    adapter.on('play', onPlay)
    adapter.on('timeupdate', onTime)
    audio.dispatchEvent(new Event('play'))
    audio.dispatchEvent(new Event('timeupdate'))
    expect(onPlay).toHaveBeenCalled()
    expect(onTime).toHaveBeenCalled()
  })

  it('throws when media has no blob', async () => {
    const broken = { ...media, blob: undefined }
    const adapter = new AudioFileAdapter(broken)
    await expect(adapter.mount(document.createElement('div'))).rejects.toThrow()
  })
})
