import { withRetry, withTimeout } from '~/lib/utils/retry-utils'

const GROQ_TIMEOUT_MS = 30000
/** Initial attempt plus 2 retries (3 total). */
const MAX_ATTEMPTS = 3

export async function withGroqRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
  const result = await withRetry(operation, {
    maxAttempts: MAX_ATTEMPTS,
    onRetry: (error, attempt) => {
      console.warn(`[${context}] Groq request failed (attempt ${attempt}): ${error.message}`)
    },
  })

  if (!result.success) {
    throw result.error || new Error(`${context} failed after ${MAX_ATTEMPTS} attempts`)
  }

  return result.data as T
}

export async function withGroqTimeout<T>(operation: () => Promise<T>, context: string): Promise<T> {
  return withTimeout(
    operation(),
    GROQ_TIMEOUT_MS,
    `${context} timed out after ${GROQ_TIMEOUT_MS}ms`,
  )
}

export async function safeGroqRequest<T>(operation: () => Promise<T>, context: string): Promise<T> {
  return withGroqRetry(() => withGroqTimeout(operation, context), context)
}
