import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { processTranscription } from '~/lib/ai/groq-whisper'
import { apiError, apiSuccess } from '~/lib/utils/api-response'
import { isValidAudioFile } from '~/lib/utils/file-validation'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitConfig,
  getRateLimitHeaders,
} from '~/lib/utils/rate-limiter'

const transcribeQuerySchema = z.object({
  fileId: z.string().min(1, 'fileId is required'),
  chunkIndex: z.coerce.number().int().min(0).optional(),
  offsetSec: z.coerce.number().min(0).optional(),
  language: z.string().optional().default('en'),
})

function isFileLike(obj: unknown): obj is File {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'name' in obj &&
    typeof obj.name === 'string' &&
    'size' in obj &&
    typeof obj.size === 'number' &&
    'type' in obj &&
    typeof obj.type === 'string' &&
    'arrayBuffer' in obj &&
    typeof obj.arrayBuffer === 'function'
  )
}

const transcribeFormSchema = z.object({
  audio: z.any().refine((file) => isFileLike(file), { message: 'Audio file is required' }),
  meta: z
    .object({
      fileId: z.string().optional(),
      chunkIndex: z.number().int().min(0).optional(),
      offsetSec: z.number().min(0).optional(),
    })
    .optional(),
})

function validateQueryParams(searchParams: Record<string, string>) {
  const validatedQuery = transcribeQuerySchema.safeParse(searchParams)
  if (!validatedQuery.success) {
    const issues = validatedQuery.error.issues.reduce(
      (acc, issue, index) => {
        acc[`issue_${index}`] = {
          code: issue.code,
          message: issue.message,
          path: issue.path.join('.'),
        }
        return acc
      },
      {} as Record<string, unknown>,
    )
    return {
      success: false as const,
      error: apiError({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: issues,
        statusCode: 400,
      }),
    }
  }
  return { success: true as const, data: validatedQuery.data }
}

function validateFormData(formData: FormData) {
  const uploadedFile = formData.get('audio') ?? formData.get('file')

  if (!isFileLike(uploadedFile)) {
    return {
      success: false as const,
      error: apiError({
        code: 'VALIDATION_ERROR',
        message: 'Audio file is required',
        details: { reason: 'MISSING_AUDIO' },
        statusCode: 400,
      }),
    }
  }

  const MAX_FILE_SIZE_MB = 25
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

  if (uploadedFile.size > MAX_FILE_SIZE_BYTES) {
    return {
      success: false as const,
      error: apiError({
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
        details: { reason: 'FILE_TOO_LARGE', size: uploadedFile.size },
        statusCode: 413,
      }),
    }
  }

  if (!isValidAudioFile(uploadedFile)) {
    return {
      success: false as const,
      error: apiError({
        code: 'VALIDATION_ERROR',
        message: 'Unsupported audio file type',
        details: {
          reason: 'INVALID_AUDIO_TYPE',
          type: uploadedFile.type,
          name: uploadedFile.name,
        },
        statusCode: 400,
      }),
    }
  }

  let parsedMeta: unknown
  const rawMeta = formData.get('meta')
  if (typeof rawMeta === 'string' && rawMeta.trim().length > 0) {
    try {
      parsedMeta = JSON.parse(rawMeta)
    } catch (metaError) {
      return {
        success: false as const,
        error: apiError({
          code: 'VALIDATION_ERROR',
          message: 'Invalid metadata payload',
          details: {
            reason: 'INVALID_META_JSON',
            error: metaError instanceof Error ? metaError.message : String(metaError),
          },
          statusCode: 400,
        }),
      }
    }
  }

  const validatedForm = transcribeFormSchema.safeParse({
    audio: uploadedFile,
    meta: parsedMeta,
  })

  if (!validatedForm.success) {
    const issues = validatedForm.error.issues.reduce(
      (acc, issue, index) => {
        acc[`issue_${index}`] = {
          code: issue.code,
          message: issue.message,
          path: issue.path.join('.'),
        }
        return acc
      },
      {} as Record<string, unknown>,
    )
    return {
      success: false as const,
      error: apiError({
        code: 'VALIDATION_ERROR',
        message: 'Invalid form data',
        details: issues,
        statusCode: 400,
      }),
    }
  }

  return { success: true as const, data: validatedForm.data }
}

export const Route = createFileRoute('/api/transcribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const clientId = getClientIdentifier(request)
          const rateLimitConfig = getRateLimitConfig('/api/transcribe')
          const rateLimitResult = checkRateLimit(`transcribe:${clientId}`, rateLimitConfig)

          if (rateLimitResult.limited) {
            const headers = getRateLimitHeaders(rateLimitResult)
            return apiError({
              code: 'RATE_LIMIT_EXCEEDED',
              message: rateLimitConfig.message || '请求过于频繁，请稍后再试',
              details: {
                retryAfter: rateLimitResult.retryAfter,
                resetTime: rateLimitResult.resetTime,
              },
              statusCode: 429,
              headers,
            })
          }

          const url = new URL(request.url)
          const searchParams = Object.fromEntries(url.searchParams)
          const queryValidation = validateQueryParams(searchParams)
          if (!queryValidation.success) {
            return queryValidation.error
          }

          const { language } = queryValidation.data

          const formData = await request.formData()
          const formValidation = validateFormData(formData)
          if (!formValidation.success) {
            return formValidation.error
          }

          const transcriptionResult = await processTranscription(
            formValidation.data.audio,
            language,
          )
          if (!transcriptionResult.success) {
            return transcriptionResult.error
          }

          return apiSuccess({
            status: 'completed',
            text: transcriptionResult.data.text,
            language: transcriptionResult.data.language ?? language,
            duration: transcriptionResult.data.duration,
            segments: transcriptionResult.data.segments,
            meta: formValidation.data.meta,
          })
        } catch (error) {
          const isProduction = process.env.NODE_ENV === 'production'

          return apiError({
            code: 'INTERNAL_ERROR',
            message: isProduction
              ? '转录服务暂时不可用，请稍后重试'
              : 'Internal server error during transcription',
            details: isProduction
              ? undefined
              : error instanceof Error
                ? { message: error.message, stack: error.stack }
                : undefined,
            statusCode: 500,
          })
        }
      },
    },
  },
})
