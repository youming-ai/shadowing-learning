/** * SimplifiedTranscriptionclass型定义 * Removedcomplex抽象层，keepcorefunctionality*/

// Transcription片段和单词class型
export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence?: number;
  wordTimestamps?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

export interface ProcessedSegment extends TranscriptionSegment {
  normalizedText?: string;
  translation?: string;
  annotations?: string[];
  furigana?: string;
}

// Transcription结果
export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: TranscriptionSegment[];
  model?: string;
  processingTime?: number;
  segmentsCount?: number;
}

// Transcriptionstate
export type TranscriptionStatus =
  | "idle"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

// Transcription选项
export interface TranscriptionOptions {
  language?: string;
  prompt?: string;
  onProgress?: (progress: {
    status: "pending" | "processing" | "completed" | "failed";
    progress: number;
    message?: string;
    error?: string;
  }) => void;
}

// Transcription进度
export interface TranscriptionProgress {
  fileId: number;
  status: TranscriptionStatus;
  progress: number;
  message: string;
}

// Groq SDK response（verbose_json）in包含结构
export interface GroqTranscriptionWord {
  word?: string;
  start?: number;
  end?: number;
}

export interface GroqTranscriptionSegment {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
  confidence?: number;
  words?: GroqTranscriptionWord[];
}

export interface GroqTranscriptionResponse {
  text?: string;
  language?: string;
  duration?: number;
  segments?: GroqTranscriptionSegment[];
  words?: GroqTranscriptionWord[];
  [key: string]: unknown;
}

// SimplifiedTranscription任务（Used forUI显示）
export interface TranscriptionTask {
  id: string;
  fileId: number;
  fileName: string;
  fileSize: number;
  duration?: number;
  status: TranscriptionStatus;
  priority: "low" | "normal" | "high" | "urgent";
  progress: {
    fileId: number;
    status: TranscriptionStatus;
    progress: number;
    message?: string;
    error?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    estimatedDuration?: number;
    actualDuration?: number;
    result?: {
      text: string;
      duration?: number;
      segmentsCount: number;
      language?: string;
    };
    options: TranscriptionOptions;
  };
  options?: TranscriptionOptions;
}

// Errorclass型
export class TranscriptionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}
