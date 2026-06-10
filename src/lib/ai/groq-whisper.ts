import { groqClient } from '~/lib/ai/groq-client'
import { safeGroqRequest } from '~/lib/ai/groq-request-wrapper'
import {
  buildSegmentsFromPlainText,
  buildSegmentsFromWords,
  distributeWordsIntoSegments,
  mapGroqSegmentToTranscriptionSegment,
} from '~/lib/ai/groq-transcription-utils'
import { apiError } from '~/lib/utils/api-response'
import { apiLogger } from '~/lib/utils/logger'
import type { GroqTranscriptionResponse, TranscriptionSegment } from '~/types/transcription'

export function normalizeLanguageCode(language: string): string {
  const languageMap: Record<string, string> = {
    'zh-CN': 'zh',
    'zh-TW': 'zh',
    'en-US': 'en',
    'en-GB': 'en',
    auto: 'auto',
  }

  return languageMap[language] || language.split('-')[0]
}

export async function processTranscription(
  uploadedFile: File,
  language: string,
): Promise<
  | {
      success: true
      data: {
        segments: Array<{
          start: number
          end: number
          text: string
          wordTimestamps?: Array<{
            word: string
            start: number
            end: number
          }>
          confidence?: number
          id: number
        }>
        text?: string
        language?: string
        duration?: number
      }
    }
  | { success: false; error: Response }
> {
  apiLogger.debug('开始处理转录请求 (Groq SDK):', {
    fileName: uploadedFile.name,
    fileSize: uploadedFile.size,
    fileType: uploadedFile.type,
    language,
  })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return {
      success: false as const,
      error: apiError({
        code: 'API_KEY_MISSING',
        message: 'Groq API key is not configured',
        details: {
          fileName: uploadedFile.name,
        },
        statusCode: 500,
      }),
    }
  }

  const normalizedLanguage = normalizeLanguageCode(language)

  try {
    const transcription = await safeGroqRequest(
      () =>
        groqClient.audio.transcriptions.create({
          file: uploadedFile,
          model: 'whisper-large-v3-turbo',
          temperature: 0,
          response_format: 'verbose_json',
          language: normalizedLanguage === 'auto' ? undefined : normalizedLanguage,
          timestamp_granularities: ['word', 'segment'],
        }),
      'transcribe',
    )

    const transcriptionData = transcription as GroqTranscriptionResponse

    apiLogger.debug('转录成功完成 (Groq SDK):', {
      fileName: uploadedFile.name,
      textLength: transcriptionData.text?.length || 0,
      duration: transcriptionData.duration,
      language: transcriptionData.language,
    })

    let processedSegments: TranscriptionSegment[] = []

    if (Array.isArray(transcriptionData.segments) && transcriptionData.segments.length > 0) {
      processedSegments = transcriptionData.segments.map((segment, index) =>
        mapGroqSegmentToTranscriptionSegment(segment, index + 1),
      )
      apiLogger.debug('使用 Groq SDK 返回的 segments:', processedSegments.length)

      if (Array.isArray(transcriptionData.words) && transcriptionData.words.length > 0) {
        const topLevelWords = transcriptionData.words.map((word) => ({
          word: word.word ?? '',
          start: typeof word.start === 'number' ? word.start : 0,
          end:
            typeof word.end === 'number'
              ? word.end
              : typeof word.start === 'number'
                ? word.start
                : 0,
        }))
        processedSegments = distributeWordsIntoSegments(processedSegments, topLevelWords)
        apiLogger.debug('按时间分配顶层 words 进 segments:', topLevelWords.length)
      }
    } else if (Array.isArray(transcriptionData.words) && transcriptionData.words.length > 0) {
      apiLogger.debug('Groq SDK 未返回 segments，根据 words 生成')
      processedSegments = buildSegmentsFromWords(transcriptionData.words, 10)
      apiLogger.debug('根据 words 生成的 segments:', processedSegments.length)
    } else if (typeof transcriptionData.text === 'string' && transcriptionData.text.length > 0) {
      apiLogger.debug('Groq SDK 未返回详细数据，生成基本 segments')
      processedSegments = buildSegmentsFromPlainText(
        transcriptionData.text,
        transcriptionData.duration,
      )
      apiLogger.debug('生成的基本 segments:', processedSegments.length)
    }

    const transcriptionResponse = {
      text: transcriptionData.text ?? '',
      language: transcriptionData.language || language,
      duration: transcriptionData.duration,
      segments: processedSegments,
    }

    return { success: true as const, data: transcriptionResponse }
  } catch (transcriptionError) {
    apiLogger.error('转录处理失败 (Groq SDK):', {
      fileName: uploadedFile.name,
      error:
        transcriptionError instanceof Error
          ? transcriptionError.message
          : String(transcriptionError),
    })

    let errorMessage = '转录失败'
    let statusCode = 500
    let errorCode = 'TRANSCRIPTION_ERROR'

    if (transcriptionError instanceof Error) {
      if (transcriptionError.message.includes('API key')) {
        errorMessage = 'API 密钥无效或已过期'
        statusCode = 401
        errorCode = 'INVALID_API_KEY'
      } else if (transcriptionError.message.includes('quota')) {
        errorMessage = 'API 配额已用完'
        statusCode = 429
        errorCode = 'QUOTA_EXCEEDED'
      } else if (transcriptionError.message.includes('file too large')) {
        errorMessage = '音频文件过大'
        statusCode = 400
        errorCode = 'FILE_TOO_LARGE'
      } else if (transcriptionError.message.includes('unsupported')) {
        errorMessage = '不支持的音频格式'
        statusCode = 400
        errorCode = 'UNSUPPORTED_FORMAT'
      } else {
        errorMessage = transcriptionError.message
      }
    }

    return {
      success: false as const,
      error: apiError({
        code: errorCode,
        message: errorMessage,
        details: {
          error:
            transcriptionError instanceof Error
              ? transcriptionError.message
              : String(transcriptionError),
          fileName: uploadedFile.name,
          fileSize: uploadedFile.size,
          fileType: uploadedFile.type,
          suggestion: '请检查音频文件格式和大小，或稍后重试',
        },
        statusCode,
      }),
    }
  }
}
