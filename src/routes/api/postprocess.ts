import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { groqClient } from '~/lib/ai/groq-client'
import { safeGroqRequest } from '~/lib/ai/groq-request-wrapper'
import { apiError, apiFromError, apiSuccess } from '~/lib/utils/api-response'
import { validationError } from '~/lib/utils/error-handler'
import { apiLogger } from '~/lib/utils/logger'
import { checkRateLimit, getClientIdentifier, getRateLimitConfig } from '~/lib/utils/rate-limiter'

const GROQ_CHAT_MODEL = 'openai/gpt-oss-120b'

const LANGUAGE_NAMES: Record<string, string> = {
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  zh: 'Chinese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
}

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code
}

interface PostProcessResult {
  originalText: string
  normalizedText: string
  translation: string | undefined
  annotations: string[] | undefined
  furigana?: string
  start: number
  end: number
  segmentIndex: number
}

const postProcessSchema = z.object({
  segments: z.array(
    z.object({
      text: z.string(),
      start: z.number(),
      end: z.number(),
      segmentIndex: z.number().optional(),
      wordTimestamps: z
        .array(
          z.object({
            word: z.string(),
            start: z.number(),
            end: z.number(),
          }),
        )
        .optional(),
    }),
  ),
  language: z.string().optional().default('ja'),
  targetLanguage: z.string().optional().default('en'),
  enableAnnotations: z.boolean().optional().default(true),
  enableFurigana: z.boolean().optional().default(true),
})

function validateRequestData(body: unknown) {
  const validation = postProcessSchema.safeParse(body)
  if (!validation.success) {
    const error = validationError('Invalid request data', validation.error.format())
    return { isValid: false, error }
  }
  return { isValid: true, data: validation.data }
}

function validateSegments(segments: Array<{ text: string; start: number; end: number }>) {
  if (!segments || segments.length === 0) {
    return {
      isValid: false,
      error: {
        code: 'NO_SEGMENTS' as const,
        message: 'No segments provided for post-processing',
        statusCode: 400,
      },
    }
  }

  if (segments.length > 100) {
    return {
      isValid: false,
      error: {
        code: 'TOO_MANY_SEGMENTS' as const,
        message: 'Too many segments for post-processing (max: 100)',
        statusCode: 400,
      },
    }
  }

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (!segment.text || typeof segment.start !== 'number' || typeof segment.end !== 'number') {
      return {
        isValid: false,
        error: {
          code: 'INVALID_SEGMENT' as const,
          message: `Invalid segment at index ${i}: missing required fields`,
          statusCode: 400,
        },
      }
    }
  }

  const MAX_SEGMENT_TEXT_LENGTH = 2000
  const MAX_TOTAL_TEXT_LENGTH = 10000

  let totalLength = 0
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].text.length > MAX_SEGMENT_TEXT_LENGTH) {
      return {
        isValid: false,
        error: {
          code: 'SEGMENT_TOO_LONG' as const,
          message: `Segment ${i} exceeds ${MAX_SEGMENT_TEXT_LENGTH} characters`,
          statusCode: 400,
        },
      }
    }
    totalLength += segments[i].text.length
  }

  if (totalLength > MAX_TOTAL_TEXT_LENGTH) {
    return {
      isValid: false,
      error: {
        code: 'TOTAL_TEXT_TOO_LONG' as const,
        message: `Total text length exceeds ${MAX_TOTAL_TEXT_LENGTH} characters`,
        statusCode: 400,
      },
    }
  }

  return { isValid: true }
}

function handleSpecificError(error: Error) {
  if (error.message.includes('timeout')) {
    return apiError({
      code: 'TIMEOUT',
      message: 'Post-processing timeout',
      details: error.message,
      statusCode: 408,
    })
  }

  if (error.message.includes('Rate limit')) {
    return apiError({
      code: 'RATE_LIMIT',
      message: 'Rate limit exceeded',
      details: error.message,
      statusCode: 429,
    })
  }

  if (error.message.includes('API key')) {
    return apiError({
      code: 'AUTH_ERROR',
      message: 'API authentication failed',
      details: error.message,
      statusCode: 401,
    })
  }

  return null
}

function validateGroqConfiguration(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!process.env.GROQ_API_KEY) {
    errors.push('Groq API key is not configured')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

const defaultOptions = {
  targetLanguage: 'en',
  enableAnnotations: true,
  enableFurigana: true,
}

function buildPrompt(
  text: string,
  sourceLanguage: string,
  targetLanguage?: string,
  enableAnnotations: boolean = true,
  enableFurigana: boolean = true,
): string {
  const sourceLangName = getLanguageName(sourceLanguage)
  const targetLangName = targetLanguage ? getLanguageName(targetLanguage) : undefined

  let basePrompt = `You are a professional language teachers specializing in ${sourceLangName} language learning and shadowing practice.\n\nTask: Process the following ${sourceLangName} text for language learners.\n\nInput:\n${text}\n\nRequirements:\n1. Normalize the text (remove filler words, fix grammar, etc.)\n2. ${targetLangName ? `Provide translation to ${targetLangName}` : 'Keep original language'}`

  if (enableAnnotations) {
    basePrompt += `\n3. Add grammatical and cultural annotations`
  }

  if (enableFurigana && sourceLanguage === 'ja') {
    basePrompt += `\n4. Include furigana for kanji`
  }

  basePrompt += `\n\nOutput format:\n{\n  "normalizedText": "Clean, normalized text",\n  "translation": "Translation if requested",\n  "annotations": ["List of annotations"],\n  "furigana": "Text with furigana if applicable",\n  "terminology": {"term": "reading and definition"}\n}`

  return basePrompt
}

interface GroqPostProcessResponse {
  normalizedText: string
  translation?: string
  annotations?: string[]
  furigana?: string
  terminology?: Record<string, string>
}

function parseGroqResponse(responseText: string): GroqPostProcessResponse {
  try {
    let cleanedText = responseText.trim()
    if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7)
    if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3)
    if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3)

    const jsonStart = cleanedText.indexOf('{')
    const jsonEnd = cleanedText.lastIndexOf('}')

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1)
    }

    const payload = JSON.parse(cleanedText)
    return {
      normalizedText: payload.normalizedText || payload.text || '',
      translation: payload.translation,
      annotations: payload.annotations || [],
      furigana: payload.furigana,
      terminology: payload.terminology || {},
    }
  } catch (_error) {
    return {
      normalizedText: responseText || '',
      translation: '',
      annotations: [],
      furigana: '',
      terminology: {},
    }
  }
}

async function postProcessSegmentWithGroq(
  segment: { text: string; start: number; end: number; segmentIndex: number },
  sourceLanguage: string,
  options: {
    targetLanguage?: string
    enableAnnotations?: boolean
    enableFurigana?: boolean
  },
): Promise<PostProcessResult> {
  const startTime = Date.now()

  try {
    const prompt = buildPrompt(
      segment.text,
      sourceLanguage,
      options.targetLanguage,
      options.enableAnnotations,
      options.enableFurigana,
    )

    const sourceLangName = getLanguageName(sourceLanguage)
    const response = await safeGroqRequest(
      () =>
        groqClient.chat.completions.create({
          model: GROQ_CHAT_MODEL,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are a professional ${sourceLangName} language teacher producing shadowing-practice material. Provide accurate, faithful translations and normalizations — do not invent content beyond the source. Respond with valid JSON only.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      'postprocess-segment',
    )

    const responseText = response.choices[0]?.message?.content || ''

    const parsed = parseGroqResponse(responseText)

    const processingTime = Date.now() - startTime
    apiLogger.debug(`单个segment AI SDK处理完成，耗时: ${processingTime}ms`)

    return {
      originalText: segment.text,
      normalizedText: parsed.normalizedText,
      translation: parsed.translation,
      annotations: parsed.annotations,
      furigana: parsed.furigana,
      start: segment.start,
      end: segment.end,
      segmentIndex: segment.segmentIndex,
    }
  } catch (error) {
    const processingTime = Date.now() - startTime
    apiLogger.error(`单个segment AI SDK处理失败，耗时: ${processingTime}ms，错误:`, error)

    throw error
  }
}

async function postProcessShortTextsBatch(
  shortTextSegments: Array<{ text: string; start: number; end: number; segmentIndex: number }>,
  sourceLanguage: string,
  options: {
    targetLanguage?: string
    enableAnnotations?: boolean
    enableFurigana?: boolean
  },
): Promise<PostProcessResult[]> {
  if (shortTextSegments.length === 0) return []

  apiLogger.debug(`AI SDK批量处理 ${shortTextSegments.length} 个短文本segments`)
  const startTime = Date.now()

  const sourceLangName = getLanguageName(sourceLanguage)
  const targetLangName = options.targetLanguage ? getLanguageName(options.targetLanguage) : null
  const wantFurigana = options.enableFurigana && sourceLanguage === 'ja'

  try {
    const combinedText = shortTextSegments
      .map((seg, index) => `[SEGMENT_${index}] ${seg.text}`)
      .join('\n')

    const prompt = `You are processing ${shortTextSegments.length} independent ${sourceLangName} text segments for language learning. Each [SEGMENT_N] line is a SEPARATE sentence — translate and normalize each one on its own. Do NOT merge segments, do NOT carry context between them, and do NOT skip any.

Source language: ${sourceLangName}
${targetLangName ? `Target language for translation: ${targetLangName}` : 'No translation requested.'}

Segments (one per line, prefixed with [SEGMENT_N] where N is the 0-based id):
${combinedText}

Return ONLY valid JSON in this exact shape, with one entry per input segment, "id" matching the [SEGMENT_N] number, in the same order:
{
  "segments": [
    {
      "id": 0,
      "normalizedText": "the segment's ${sourceLangName} text, lightly cleaned (fix obvious recognition typos, drop fillers); preserve meaning",${
        targetLangName
          ? `\n      "translation": "faithful ${targetLangName} translation of THIS segment only — do not invent content not present in the source",`
          : ''
      }${wantFurigana ? `\n      "furigana": "the segment's text with kana readings for kanji",` : ''}
      "annotations": []
    }
  ]
}`

    const response = await safeGroqRequest(
      () =>
        groqClient.chat.completions.create({
          model: GROQ_CHAT_MODEL,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are a professional ${sourceLangName} language teacher producing learning material. Translate and normalize each provided segment independently and faithfully. Never merge segments. Respond with valid JSON only.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      'postprocess-batch',
    )

    let cleanedText = response.choices[0]?.message?.content?.trim() || ''
    if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7)
    if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3)
    if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3)

    const jsonStart = cleanedText.indexOf('{')
    const jsonEnd = cleanedText.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1)
    }

    const batchResponse = JSON.parse(cleanedText)

    if (batchResponse.segments && Array.isArray(batchResponse.segments)) {
      const processingTime = Date.now() - startTime
      apiLogger.debug(`批量AI SDK处理完成，耗时: ${processingTime}ms`)

      return shortTextSegments.map((originalSegment, index) => {
        const processedSegment = batchResponse.segments[index]
        return {
          originalText: originalSegment.text,
          normalizedText: processedSegment?.normalizedText || originalSegment.text,
          translation: processedSegment?.translation || '',
          annotations: processedSegment?.annotations || [],
          furigana: processedSegment?.furigana || '',
          start: originalSegment.start,
          end: originalSegment.end,
          segmentIndex: originalSegment.segmentIndex,
        }
      })
    }

    const processingTime = Date.now() - startTime
    apiLogger.warn(`批量AI SDK处理解析失败，使用fallback，耗时: ${processingTime}ms`)

    return shortTextSegments.map((segment) => ({
      originalText: segment.text,
      normalizedText: segment.text,
      translation: '',
      annotations: [],
      furigana: '',
      start: segment.start,
      end: segment.end,
      segmentIndex: segment.segmentIndex,
    }))
  } catch (error) {
    const processingTime = Date.now() - startTime
    apiLogger.error(`批量AI SDK处理失败，耗时: ${processingTime}ms，错误:`, error)

    return shortTextSegments.map((segment) => ({
      originalText: segment.text,
      normalizedText: segment.text,
      translation: '',
      annotations: [],
      furigana: '',
      start: segment.start,
      end: segment.end,
      segmentIndex: segment.segmentIndex,
    }))
  }
}

async function postProcessSegmentsWithGroq(
  segments: Array<{ text: string; start: number; end: number; segmentIndex: number }>,
  sourceLanguage: string,
  options: {
    targetLanguage?: string
    enableAnnotations?: boolean
    enableFurigana?: boolean
  },
): Promise<PostProcessResult[]> {
  const finalOptions = { ...defaultOptions, ...options }

  const SHORT_TEXT_THRESHOLD = 50

  const segmentCount = segments.length
  let MAX_CONCURRENT = 3
  let BATCH_SIZE = 5

  if (segmentCount <= 3) {
    MAX_CONCURRENT = 2
    BATCH_SIZE = 3
  } else if (segmentCount <= 10) {
    MAX_CONCURRENT = 3
    BATCH_SIZE = 4
  } else if (segmentCount <= 20) {
    MAX_CONCURRENT = 4
    BATCH_SIZE = 5
  } else {
    MAX_CONCURRENT = 5
    BATCH_SIZE = 6
  }

  apiLogger.debug(`开始后处理 ${segments.length} 个segments，使用 ${MAX_CONCURRENT} 并发`)
  const startTime = Date.now()

  const shortTextSegments = segments.filter((seg) => seg.text.length <= SHORT_TEXT_THRESHOLD)
  const longTextSegments = segments.filter((seg) => seg.text.length > SHORT_TEXT_THRESHOLD)

  apiLogger.debug(`短文本: ${shortTextSegments.length} 个，长文本: ${longTextSegments.length} 个`)

  const collected: PostProcessResult[] = []

  if (shortTextSegments.length > 0) {
    const shortTextResults = await postProcessShortTextsBatch(
      shortTextSegments,
      sourceLanguage,
      finalOptions,
    )
    collected.push(...shortTextResults)
    apiLogger.debug(`短文本批量处理完成: ${shortTextResults.length} 个`)
  }

  if (longTextSegments.length > 0) {
    const batches: Array<typeof longTextSegments> = []
    for (let i = 0; i < longTextSegments.length; i += BATCH_SIZE) {
      batches.push(longTextSegments.slice(i, i + BATCH_SIZE))
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      apiLogger.debug(
        `处理长文本第 ${batchIndex + 1}/${batches.length} 批，包含 ${batch.length} 个segments`,
      )

      const batchPromises = batch.map(async (segment, segmentIndex) => {
        try {
          const processed = await postProcessSegmentWithGroq(segment, sourceLanguage, finalOptions)
          apiLogger.debug(`长文本Segment ${segmentIndex + 1}/${batch.length} 处理完成`)
          return processed
        } catch (error) {
          apiLogger.error(`长文本Segment ${segmentIndex + 1}/${batch.length} 处理失败:`, error)
          return {
            originalText: segment.text,
            normalizedText: segment.text,
            translation: '',
            annotations: [],
            furigana: '',
            start: segment.start,
            end: segment.end,
            segmentIndex: segment.segmentIndex,
          } satisfies PostProcessResult
        }
      })

      const batchResults = await Promise.allSettled(batchPromises)

      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i]
        if (result.status === 'fulfilled') {
          collected.push(result.value)
        } else {
          const original = batch[i]
          apiLogger.warn('Long text batch result rejected:', result.reason)
          collected.push({
            originalText: original.text,
            normalizedText: original.text,
            translation: '',
            annotations: undefined,
            furigana: '',
            start: original.start,
            end: original.end,
            segmentIndex: original.segmentIndex,
          })
        }
      }

      if (batchIndex < batches.length - 1) {
        const delay = Math.min(200, Math.max(50, MAX_CONCURRENT * 50))
        apiLogger.debug(`长文本批次间延迟 ${delay}ms`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  const ordered: PostProcessResult[] = new Array(segments.length)
  const byIndex = new Map<number, PostProcessResult>()
  for (const result of collected) {
    byIndex.set(result.segmentIndex, result)
  }
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const found = byIndex.get(segment.segmentIndex)
    ordered[i] = found ?? {
      originalText: segment.text,
      normalizedText: segment.text,
      translation: '',
      annotations: undefined,
      furigana: '',
      start: segment.start,
      end: segment.end,
      segmentIndex: segment.segmentIndex,
    }
  }

  const endTime = Date.now()
  apiLogger.debug(
    `后处理完成，总耗时: ${endTime - startTime}ms，处理了 ${ordered.length} 个segments`,
  )

  return ordered
}

export const Route = createFileRoute('/api/postprocess')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const configValidation = validateGroqConfiguration()
          if (!configValidation.isValid) {
            return apiError({
              code: 'CONFIG_ERROR',
              message: 'Groq configuration invalid',
              details: configValidation.errors,
              statusCode: 500,
            })
          }

          const clientKey = getClientIdentifier(request)
          const rateLimitConfig = getRateLimitConfig('/api/postprocess')
          const rateLimit = checkRateLimit(`postprocess:${clientKey}`, rateLimitConfig)
          if (rateLimit.limited) {
            return apiError({
              code: 'RATE_LIMIT',
              message: 'Too many postprocess requests',
              statusCode: 429,
              headers: {
                'X-RateLimit-Limit': String(rateLimitConfig.maxRequests),
                'X-RateLimit-Remaining': String(rateLimit.remaining),
                'X-RateLimit-Reset': String(rateLimit.resetTime),
                'Retry-After': String(Math.ceil(rateLimit.resetTime - Date.now() / 1000)),
              },
            })
          }

          const body = await request.json()
          const validation = validateRequestData(body)
          if (!validation.isValid) {
            return apiError(
              validation.error ?? {
                code: 'INVALID_REQUEST' as const,
                message: 'Invalid request data',
                statusCode: 400,
              },
            )
          }

          const data = validation.data
          if (!data) {
            return apiError({
              code: 'INVALID_REQUEST' as const,
              message: 'Request data is missing',
              statusCode: 400,
            })
          }
          const { segments, language, targetLanguage, enableAnnotations, enableFurigana } = data

          const segmentValidation = validateSegments(segments)
          if (!segmentValidation.isValid) {
            return apiError(
              segmentValidation.error ?? {
                code: 'UNKNOWN_VALIDATION_ERROR' as const,
                message: 'Segment validation failed',
                statusCode: 400,
              },
            )
          }

          const indexedSegments = segments.map((segment, index) => ({
            text: segment.text,
            start: segment.start,
            end: segment.end,
            segmentIndex: typeof segment.segmentIndex === 'number' ? segment.segmentIndex : index,
          }))

          const processedSegments = await postProcessSegmentsWithGroq(indexedSegments, language, {
            targetLanguage,
            enableAnnotations,
            enableFurigana,
          })

          const finalSegments = processedSegments.map((processedSegment, index) => ({
            ...segments[index],
            segmentIndex: processedSegment.segmentIndex,
            normalizedText: processedSegment.normalizedText,
            translation: processedSegment.translation,
            annotations: processedSegment.annotations,
            furigana: processedSegment.furigana,
          }))

          return apiSuccess({
            processedSegments: finalSegments.length,
            segments: finalSegments,
          })
        } catch (error) {
          if (error instanceof Error) {
            const specificError = handleSpecificError(error)
            if (specificError) {
              return specificError
            }
          }

          return apiFromError(error, 'postprocess/POST')
        }
      },
    },
  },
})
