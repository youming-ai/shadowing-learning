export interface FileRow {
  id?: number
  name: string
  size: number
  type: string
  blob?: Blob
  isChunked?: boolean
  chunkSize?: number
  totalChunks?: number
  duration?: number
  uploadedAt: Date
  updatedAt: Date
}

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface TranscriptRow {
  id?: number
  fileId: number
  status: ProcessingStatus
  rawText?: string
  text?: string
  language?: string
  duration?: number
  error?: string
  processingTime?: number
  postProcessStatus?: 'pending' | 'completed' | 'failed'
  postProcessError?: string
  createdAt: Date
  updatedAt: Date
}

export interface WordTimestamp {
  word: string
  start: number
  end: number
  confidence?: number
}

export interface Segment {
  id?: number
  /** v4 起指向 subtitles.id（历史字段名保留，避免重写最大的表） */
  transcriptId: number
  segmentIndex?: number
  start: number
  end: number
  text: string
  normalizedText?: string
  translation?: string
  annotations?: string[]
  furigana?: string
  wordTimestamps?: WordTimestamp[]
  createdAt: Date
  updatedAt: Date
}

// ===== v4 unified media model =====

export type MediaKind = 'audio' | 'youtube'

export interface MediaRow {
  id?: number
  kind: MediaKind
  title: string
  durationSec: number | null
  addedAt: Date
  updatedAt: Date
  // kind: 'audio'
  blob?: Blob
  fileName?: string
  fileSize?: number
  mimeType?: string
  // kind: 'youtube'
  externalId?: string
  channelName?: string
  thumbnailUrl?: string
  sourceUrl?: string
}

export type AudioMedia = MediaRow & { kind: 'audio'; blob: Blob }
export type YouTubeMedia = MediaRow & { kind: 'youtube'; externalId: string }

export type SubtitleSource = 'official' | 'whisper'

export interface SubtitleRow {
  id?: number
  mediaId: number
  source: SubtitleSource
  status: ProcessingStatus // 'pending' | 'processing' | 'completed' | 'failed'
  sourceLanguage: string
  targetLanguage: string | null
  postProcessStatus?: 'pending' | 'completed' | 'failed'
  postProcessError?: string
  rawText?: string
  error?: string
  createdAt: Date
  updatedAt: Date
}

export interface FileWithTranscripts extends FileRow {
  transcripts: TranscriptRow[]
}

export interface TranscriptWithSegments extends TranscriptRow {
  segments: Segment[]
}

export interface DatabaseStats {
  totalFiles: number
  totalTranscripts: number
  totalSegments: number
  processingStatus: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
}

export type { AudioPlayerState } from '../player'
