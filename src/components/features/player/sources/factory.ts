import type { MediaRow } from '~/types/db/database'
import { AudioFileAdapter } from './AudioFileAdapter'
import type { MediaSourceAdapter } from './types'
import { YouTubeAdapter } from './YouTubeAdapter'

export function createAdapter(media: MediaRow): MediaSourceAdapter {
  return media.kind === 'youtube' ? new YouTubeAdapter(media) : new AudioFileAdapter(media)
}
