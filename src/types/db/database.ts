export interface FileRow {
  id?: number;
  name: string;
  size: number;
  type: string;
  blob?: Blob;
  isChunked?: boolean;
  chunkSize?: number;
  totalChunks?: number;
  duration?: number;
  uploadedAt: Date;
  updatedAt: Date;
}

export type ProcessingStatus = "pending" | "processing" | "completed" | "failed";

export interface TranscriptRow {
  id?: number;
  fileId: number;
  status: ProcessingStatus;
  rawText?: string;
  text?: string;
  language?: string;
  duration?: number;
  error?: string;
  processingTime?: number;
  postProcessStatus?: "pending" | "completed" | "failed";
  postProcessError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface Segment {
  id?: number;
  transcriptId: number;
  segmentIndex?: number;
  start: number;
  end: number;
  text: string;
  normalizedText?: string;
  translation?: string;
  romaji?: string;
  annotations?: string[];
  furigana?: string;
  wordTimestamps?: WordTimestamp[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FileWithTranscripts extends FileRow {
  transcripts: TranscriptRow[];
}

export interface TranscriptWithSegments extends TranscriptRow {
  segments: Segment[];
}

export interface DatabaseStats {
  totalFiles: number;
  totalTranscripts: number;
  totalSegments: number;
  processingStatus: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

export type { AudioPlayerState } from "../player";
