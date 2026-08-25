import Dexie from 'dexie'
import {
  type AppError,
  type ErrorCode,
  ErrorCodes,
  type ErrorContext,
  type ErrorMonitor,
  getDefaultErrorMessage,
  LogLevel,
} from '~/types/api/errors'

export { LogLevel }

// 全局错误监控（可选接入）
let globalErrorMonitor: ErrorMonitor | null = null

export function setErrorMonitor(monitor: ErrorMonitor): void {
  globalErrorMonitor = monitor
}

export function getErrorMonitor(): ErrorMonitor | null {
  return globalErrorMonitor
}

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

export function logError(error: AppError, context?: string): void {
  const errorContext: ErrorContext = {
    timestamp: Date.now(),
    component: context,
    additional: { ...(error.details || {}), stack: getErrorStack(error) },
  }
  if (globalErrorMonitor) globalErrorMonitor.logError(error, errorContext)
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

export function handleSilently(error: unknown): AppError {
  if (isAppError(error)) return error
  if (error instanceof Error)
    return createError('internalServerError', error.message, { stack: error.stack }, 500)
  return createError(
    'internalServerError',
    '未知错误',
    typeof error === 'object' && error !== null ? { error } : undefined,
    500,
  )
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
  if (isApiKeyError(error)) return '请配置 GROQ_API_KEY 环境变量以使用转录功能'
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
    if (m.includes('file size') || m.includes('文件大小')) return '文件太大，请上传较小的音频文件'
    return error.message
  }
  return '未知错误，请重试'
}

// 向后兼容：保留 handleAndShowError / showErrorToast 的最小桩，避免外部旧调用崩溃
// ponytail: 仅为兼容存根，真正 toast 由调用方直接 toast.error(getFriendlyErrorMessage(e))
import { toast } from 'sonner'

export function showErrorToast(error: AppError | unknown): void {
  const appError = isAppError(error) ? error : handleError(error)
  toast.error(getDefaultErrorMessage(appError.code) || appError.message)
}

export function handleAndShowError(error: unknown, context?: string, customMessage?: string): AppError {
  const appError = handleError(error, context)
  showErrorToast(customMessage ? { ...appError, message: customMessage } : appError)
  return appError
}
