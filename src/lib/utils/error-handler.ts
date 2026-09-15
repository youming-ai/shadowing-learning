import Dexie from 'dexie'
import { type AppError, type ErrorCode, ErrorCodes, LogLevel } from '~/types/api/errors'
import { errorLogger } from './logger'

export { LogLevel }

export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  statusCode: number = 500,
  cause?: Error,
): AppError {
  const errorCode = ErrorCodes[code]
  return {
    code: errorCode,
    message,
    details,
    statusCode,
    timestamp: Date.now(),
    stack: cause?.stack,
    cause: cause ? { message: cause.message, code: (cause as { code?: string }).code } : undefined,
    context: { timestamp: Date.now() },
  }
}

function getErrorStack(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'stack' in error) {
    const s = (error as { stack?: unknown }).stack
    if (typeof s === 'string') return s
  }
  return undefined
}

/** 记录一次错误。走统一 logger（生产环境静默），不再依赖已移除的全局 monitor 钩子。*/
export function logError(error: AppError, context?: string): void {
  errorLogger.error(context ? `[${context}]` : '', error, getErrorStack(error) ?? '')
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'statusCode' in error
  )
}

export function handleError(error: unknown, context?: string): AppError {
  if (isAppError(error)) {
    logError(error, context)
    return error
  }
  if (typeof error === 'string') {
    const appError = createError('internalServerError', error, undefined, 500)
    logError(appError, context)
    return appError
  }
  if (error instanceof Error) {
    const appError = createError('internalServerError', error.message, { stack: error.stack }, 500)
    logError(appError, context)
    return appError
  }
  const appError = createError(
    'internalServerError',
    '未知错误',
    typeof error === 'object' && error !== null ? { error } : undefined,
    500,
  )
  logError(appError, context)
  return appError
}

function isApiKeyError(error: unknown): boolean {
  if (error instanceof Error) {
    const m = error.message.toLowerCase()
    return (
      m.includes('groq_api_key') ||
      m.includes('环境变量未设置') ||
      m.includes('api key') ||
      m.includes('authentication')
    )
  }
  return false
}

export function getFriendlyErrorMessage(error: unknown): string {
  if (isApiKeyError(error)) return '请配置 GROQ_API_KEY 环境变量以使用翻译功能'
  if (
    error instanceof Dexie.VersionError ||
    error instanceof Dexie.DatabaseClosedError ||
    (error instanceof Error &&
      (error.name === 'VersionError' || error.name === 'DatabaseClosedError'))
  ) {
    return '应用已更新，请刷新页面以加载新版本'
  }
  if (error instanceof Error) {
    const m = error.message.toLowerCase()
    if (m.includes('network') || m.includes('fetch')) return '网络连接失败，请检查网络连接后重试'
    if (m.includes('timeout')) return '请求超时，请稍后重试'
    if (m.includes('rate limit')) return '请求过于频繁，请稍后重试'
    return error.message
  }
  return '未知错误，请重试'
}
