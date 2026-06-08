/** * API class型定义 * 统一 API response格式和ErrorProcessclass型*/

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    details?: Record<string, unknown>
  }
  timestamp: string
  meta?: {
    requestId?: string
    version?: string
    processingTime?: number
  }
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ApiResponse<T[]>['meta'] & {
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasNext: boolean
      hasPrev: boolean
    }
  }
}

export interface TranscriptionResponseData {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transcript?: {
    text: string
    durationInSeconds?: number
    segments?: import('./transcription').TranscriptionSegment[]
  }
  processedSegments?: import('./transcription').ProcessedSegment[]
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

// TranscriptionSegment 和 ProcessedSegment 已移至 types/transcription.t 以避免重复
// 从 types/transcription.t 重新导出以保持向后兼容
export type { ProcessedSegment, TranscriptionSegment } from './transcription'

export interface TranscriptionWord {
  word: string
  start: number
  end: number
  confidence?: number
}

export interface ProgressUpdateData {
  fileId: string
  status: string
  progress: number
  estimatedDuration?: number
  message?: string
  error?: {
    code: string
    message: string
  }
}

export interface ServiceError {
  code: string
  message: string
  details?: Record<string, unknown>
  timestamp: string
}

export type HttpErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_SERVER_ERROR'
  | 'BAD_GATEWAY'
  | 'SERVICE_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'

export type TranscriptionErrorCode =
  | 'INVALID_AUDIO_FORMAT'
  | 'AUDIO_TOO_LARGE'
  | 'TRANSCRIPTION_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SERVICE_UNAVAILABLE'
  | 'INVALID_LANGUAGE'
  | 'PROCESSING_TIMEOUT'
  | 'UNKNOWN_ERROR'
