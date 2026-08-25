/** * 重试机制工具 - 提供弹性重试和指数退避functionality*/

export interface RetryOptions {
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
  backoffFactor?: number
  retryableErrors?: string[] | ((error: Error) => boolean)
  onRetry?: (error: Error, attempt: number) => void
  shouldRetry?: (error: Error) => boolean
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
}

/** * 默认重试配置*/
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'RATE_LIMIT_ERROR',
    'ECONNRESET',
    'ETIMEDOUT',
  ],
  onRetry: () => {
    // Default no-op retry handler
  },
  shouldRetry: (_error) => true,
}

/** * 计算退避delay*/
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffFactor: number,
): number {
  const delay = baseDelay * backoffFactor ** (attempt - 1)
  return Math.min(delay, maxDelay)
}

/** * 判断Erroris否可重试*/
function isRetryableError(error: Error, options: Required<RetryOptions>): boolean {
  // 使用自定义判断函数
  if (options.shouldRetry && !options.shouldRetry(error)) {
    return false
  }

  // CheckErrorclass型
  if (Array.isArray(options.retryableErrors)) {
    const errorMessage = error.message.toUpperCase()
    const errorCode = (error as { code?: string }).code?.toUpperCase()

    return options.retryableErrors.some(
      (retryableError) => errorMessage.includes(retryableError) || errorCode === retryableError,
    )
  }

  // 使用自定义Error判断函数
  if (typeof options.retryableErrors === 'function') {
    return options.retryableErrors(error)
  }

  return true
}

/** * 带重试机制异步函数执行*/
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await fn()
      return {
        success: true,
        data: result,
        attempts: attempt,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // If这i最后一次尝试或Error不可重试，直接返回Failed
      if (attempt === config.maxAttempts || !isRetryableError(lastError, config)) {
        return {
          success: false,
          error: lastError,
          attempts: attempt,
        }
      }

      // 计算delay时间
      const delay = calculateDelay(attempt, config.baseDelay, config.maxDelay, config.backoffFactor)

      // 调用重试回调
      config.onRetry(lastError, attempt)

      // 等待delay
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: config.maxAttempts,
  }
}


