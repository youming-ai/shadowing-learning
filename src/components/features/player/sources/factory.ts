import type { MediaRow } from '~/types/db/database'
import type { MediaSourceAdapter } from './types'
import { YouTubeAdapter } from './YouTubeAdapter'

export function createAdapter(media: MediaRow): MediaSourceAdapter {
  return new YouTubeAdapter(media)
}
