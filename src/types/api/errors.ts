export interface AppError {
  code: string
  message: string
  details?: unknown
  statusCode: number
  timestamp?: number
  stack?: string
  cause?: {
    message: string
    code?: string
  }
  context?: ErrorContext
}

export interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  sessionId?: string
  timestamp?: number
  additional?: Record<string, unknown>
  requestId?: string
  traceId?: string
  spanId?: string
  monitoringConfig?: Record<string, unknown>
  alertId?: string
  startTime?: number
  alertType?: string
  resolvedAt?: string
}

export interface ErrorStats {
  totalErrors: number
  errorsByCode: Record<string, number>
  errorsByComponent: Record<string, number>
  errorsBySeverity: Record<string, number>
  lastErrorTime?: number
  errorFrequency: number
  errorRate: number // Error率 (每minutes)
}

export interface ErrorMonitor {
  logError(error: AppError, context?: ErrorContext): void
  logInfo(message: string, context?: ErrorContext): void
  logWarning(message: string, context?: ErrorContext): void
  flush?(): Promise<void>
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export enum ErrorSeverity {
  CRITICAL = 'critical', // 严重Error，影响corefunctionality
  HIGH = 'high', // 高优先级Error
  MEDIUM = 'medium', // in等Error
  LOW = 'low', // 低优先级Error
}

export enum ErrorCategory {
  DATABASE = 'database',
  API = 'api',
  FILE = 'file',
  AUDIO = 'audio',
  TRANSCRIPTION = 'transcription',
  NETWORK = 'network',
  VALIDATION = 'validation',
  SECURITY = 'security',
  BUSINESS = 'business',
  SYSTEM = 'system',
}

export const ErrorCodes = {
  // databaseError
  dbConnectionFailed: 'DB_CONNECTION_FAILED',
  dbQueryFailed: 'DB_QUERY_FAILED',
  dbRecordNotFound: 'DB_RECORD_NOT_FOUND',
  dbMigrationFailed: 'DB_MIGRATION_FAILED',
  dbIntegrityError: 'DB_INTEGRITY_ERROR',

  // API Error
  apiValidationError: 'API_VALIDATION_ERROR',
  apiAuthError: 'API_AUTH_ERROR',
  apiRateLimit: 'API_RATE_LIMIT',
  apiTimeout: 'API_TIMEOUT',

  // FileProcessError
  fileUploadFailed: 'FILE_UPLOAD_FAILED',
  fileNotFound: 'FILE_NOT_FOUND',
  fileProcessingError: 'FILE_PROCESSING_ERROR',

  // TranscriptionProcessError
  transcriptionFailed: 'TRANSCRIPTION_FAILED',
  transcriptionTimeout: 'TRANSCRIPTION_TIMEOUT',
  postProcessingFailed: 'POST_PROCESSING_FAILED',

  // AudioProcessError
  audioProcessingError: 'AUDIO_PROCESSING_ERROR',
  audioFormatUnsupported: 'AUDIO_FORMAT_UNSUPPORTED',

  // 业务逻辑Error
  invalidOperation: 'INVALID_OPERATION',
  resourceBusy: 'RESOURCE_BUSY',
  concurrencyLimit: 'CONCURRENCY_LIMIT',
  fileAlreadyProcessed: 'FILE_ALREADY_PROCESSED',

  // 系统Error
  internalServerError: 'INTERNAL_SERVER_ERROR',
  serviceUnavailable: 'SERVICE_UNAVAILABLE',
  networkError: 'NETWORK_ERROR',
  configurationError: 'CONFIGURATION_ERROR',
} as const

// Error代码配置映射
export const ErrorCodeConfig: Record<
  string,
  {
    severity: ErrorSeverity
    category: ErrorCategory
    retryable: boolean
    userFriendly: boolean
  }
> = {
  // databaseError配置
  DB_CONNECTION_FAILED: {
    severity: ErrorSeverity.CRITICAL,
    category: ErrorCategory.DATABASE,
    retryable: true,
    userFriendly: true,
  },
  DB_QUERY_FAILED: {
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.DATABASE,
    retryable: true,
    userFriendly: true,
  },
  DB_RECORD_NOT_FOUND: {
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.DATABASE,
    retryable: false,
    userFriendly: true,
  },
  DB_MIGRATION_FAILED: {
    severity: ErrorSeverity.CRITICAL,
    category: ErrorCategory.DATABASE,
    retryable: false,
    userFriendly: false,
  },
  DB_INTEGRITY_ERROR: {
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.DATABASE,
    retryable: false,
    userFriendly: true,
  },

  // API Error配置
  API_VALIDATION_ERROR: {
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.VALIDATION,
    retryable: false,
    userFriendly: true,
  },
  API_AUTH_ERROR: {
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.API,
    retryable: false,
    userFriendly: true,
  },
  API_RATE_LIMIT: {
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.API,
    retryable: true,
    userFriendly: true,
  },
  API_TIMEOUT: {
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.API,
    retryable: true,
    userFriendly: true,
  },

  // FileProcessError配置
  FILE_UPLOAD_FAILED: {
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.FILE,
    retryable: true,
    userFriendly: true,
  },
  FILE_NOT_FOUND: {
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.FILE,
    retryable: false,
    userFriendly: true,
  },
  FILE_PROCESSING_ERROR: {
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.FILE,
    retryable: true,
    userFriendly: true,
  },

  // TranscriptionProcessError配置
  TRANSCRIPTION_FAILED: {
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.TRANSCRIPTION,
    retryable: true,
    userFriendly: true,
  },
  TRANSCRIPTION_TIMEOUT: {
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.TRANSCRIPTION,
    retryable: true,
    userFriendly: true,
  },
  POST_PROCESSING_FAILED: {
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.TRANSCRIPTION,
    retryable: true,
    userFriendly: true,
  },

  // AudioProcessError配置
  AUDIO_PROCESSING_ERROR: {
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.AUDIO,
    retryable: true,
    userFriendly: true,
  },
  AUDIO_FORMAT_UNSUPPORTED: {
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.AUDIO,
    retryable: false,
    userFriendly: true,
  },

  // 业务逻辑Error配置
  INVALID_OPERATION: {
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.BUSINESS,
    retryable: false,
    userFriendly: true,
  },
  RESOURCE_BUSY: {
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.BUSINESS,
    retryable: true,
    userFriendly: true,
  },
  CONCURRENCY_LIMIT: {
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.BUSINESS,
    retryable: true,
    userFriendly: true,
  },
  FILE_ALREADY_PROCESSED: {
    severity: ErrorSeverity.LOW,
    category: ErrorCategory.BUSINESS,
    retryable: false,
    userFriendly: true,
  },

  // 系统Error配置
  INTERNAL_SERVER_ERROR: {
    severity: ErrorSeverity.CRITICAL,
    category: ErrorCategory.SYSTEM,
    retryable: false,
    userFriendly: true,
  },
  SERVICE_UNAVAILABLE: {
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.SYSTEM,
    retryable: true,
    userFriendly: true,
  },
  NETWORK_ERROR: {
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.NETWORK,
    retryable: true,
    userFriendly: true,
  },
  CONFIGURATION_ERROR: {
    severity: ErrorSeverity.CRITICAL,
    category: ErrorCategory.SYSTEM,
    retryable: false,
    userFriendly: false,
  },
}

export type ErrorCode = keyof typeof ErrorCodes

// 用户友好Error消息映射
export const UserFriendlyMessages: Record<string, string> = {
  DB_CONNECTION_FAILED: '数据库连接失败，请检查网络连接',
  DB_RECORD_NOT_FOUND: '请求的资源不存在',
  FILE_UPLOAD_FAILED: '文件上传失败，请重试',
  FILE_NOT_FOUND: '文件不存在',
  TRANSCRIPTION_FAILED: '音频转录失败，请检查音频质量',
  POST_PROCESSING_FAILED: '文本处理失败，请稍后重试',
  API_RATE_LIMIT: '请求过于频繁，请稍后再试',
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  INTERNAL_SERVER_ERROR: '系统内部错误，请联系技术支持',
  SERVICE_UNAVAILABLE: '服务暂时不可用，请稍后再试',
  API_VALIDATION_ERROR: '输入验证失败，请检查输入参数',
}

// 默认Error消息
export const getDefaultErrorMessage = (code: string): string => {
  return UserFriendlyMessages[code] || '发生未知错误，请重试'
}

// GetError配置
export const getErrorCodeConfig = (code: string) => {
  return (
    ErrorCodeConfig[code] || {
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.SYSTEM,
      retryable: false,
      userFriendly: true,
    }
  )
}

// 判断Erroris否可重试
export const isRetryableError = (code: string): boolean => {
  return getErrorCodeConfig(code).retryable
}

// GetError严重程度
export const getErrorSeverity = (code: string): ErrorSeverity => {
  return getErrorCodeConfig(code).severity
}

// GetError分class
export const getErrorCategory = (code: string): ErrorCategory => {
  return getErrorCodeConfig(code).category
}

// Error恢复策略
export interface ErrorRecoveryStrategy {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  retryCondition?: (error: AppError) => boolean
  fallbackAction?: (error: AppError) => Promise<void>
}

// 默认Error恢复策略
export const DefaultRecoveryStrategies: Record<ErrorCategory, ErrorRecoveryStrategy> = {
  [ErrorCategory.DATABASE]: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
  },
  [ErrorCategory.API]: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
  },
  [ErrorCategory.NETWORK]: {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 60000,
    backoffFactor: 2,
  },
  [ErrorCategory.FILE]: {
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffFactor: 1.5,
  },
  [ErrorCategory.AUDIO]: {
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 10000,
    backoffFactor: 1.5,
  },
  [ErrorCategory.TRANSCRIPTION]: {
    maxRetries: 3,
    baseDelay: 5000,
    maxDelay: 60000,
    backoffFactor: 2,
  },
  [ErrorCategory.VALIDATION]: {
    maxRetries: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffFactor: 1,
  },
  [ErrorCategory.SECURITY]: {
    maxRetries: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffFactor: 1,
  },
  [ErrorCategory.BUSINESS]: {
    maxRetries: 1,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffFactor: 1,
  },
  [ErrorCategory.SYSTEM]: {
    maxRetries: 1,
    baseDelay: 2000,
    maxDelay: 10000,
    backoffFactor: 1.5,
  },
}
