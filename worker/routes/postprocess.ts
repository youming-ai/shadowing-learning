import { Hono } from "hono"
import z from "zod"
import type { Env } from "../lib/types"
import { apiError, apiSuccess } from "../lib/api-response"
import { getGroqClient } from "../lib/groq-client"

const GROQ_CHAT_MODEL = "openai/gpt-oss-120b"

const LANGUAGE_NAMES: Record<string, string> = {
  "zh-CN": "Simplified Chinese",
  "zh-TW": "Traditional Chinese",
  zh: "Chinese",
  en: "English",
  ja: "Japanese",
  ko: "Korean",
}

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code
}

const postProcessSchema = z.object({
  segments: z.array(
    z.object({
      text: z.string(),
      start: z.number(),
      end: z.number(),
      segmentIndex: z.number().optional(),
    }),
  ),
  language: z.string().optional().default("ja"),
  targetLanguage: z.string().optional().default("en"),
  enableAnnotations: z.boolean().optional().default(true),
  enableFurigana: z.boolean().optional().default(true),
})

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

export const postprocessRoute = new Hono<{ Bindings: Env }>()

function buildPrompt(
  text: string,
  sourceLanguage: string,
  targetLanguage?: string,
  enableAnnotations = true,
  enableFurigana = true,
): string {
  const sourceLangName = getLanguageName(sourceLanguage)
  const targetLangName = targetLanguage ? getLanguageName(targetLanguage) : undefined

  let prompt = `You are a professional language teachers specializing in ${sourceLangName} language learning and shadowing practice.\n\nTask: Process the following ${sourceLangName} text for language learners.\n\nInput:\n${text}\n\nRequirements:\n1. Normalize the text (remove filler words, fix grammar, etc.)\n2. ${targetLangName ? `Provide translation to ${targetLangName}` : "Keep original language"}`

  if (enableAnnotations) {
    prompt += "\n3. Add grammatical and cultural annotations"
  }

  if (enableFurigana && sourceLanguage === "ja") {
    prompt += "\n4. Include furigana for kanji"
  }

  prompt +=
    '\n\nOutput format:\n{\n  "normalizedText": "Clean, normalized text",\n  "translation": "Translation if requested",\n  "annotations": ["List of annotations"],\n  "furigana": "Text with furigana if applicable",\n  "terminology": {"term": "reading and definition"}\n}'

  return prompt
}

function parseGroqResponse(responseText: string): {
  normalizedText: string
  translation?: string
  annotations?: string[]
  furigana?: string
} {
  try {
    let cleanedText = responseText.trim()
    if (cleanedText.startsWith("```json")) cleanedText = cleanedText.slice(7)
    if (cleanedText.startsWith("```")) cleanedText = cleanedText.slice(3)
    if (cleanedText.endsWith("```")) cleanedText = cleanedText.slice(0, -3)

    const jsonStart = cleanedText.indexOf("{")
    const jsonEnd = cleanedText.lastIndexOf("}")
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1)
    }

    const payload = JSON.parse(cleanedText)
    return {
      normalizedText: payload.normalizedText || payload.text || "",
      translation: payload.translation,
      annotations: payload.annotations || [],
      furigana: payload.furigana,
    }
  } catch {
    return { normalizedText: responseText || "", translation: "", annotations: [], furigana: "" }
  }
}

async function processSegment(
  groq: ReturnType<typeof getGroqClient>,
  segment: { text: string; start: number; end: number; segmentIndex: number },
  sourceLanguage: string,
  options: { targetLanguage?: string; enableAnnotations?: boolean; enableFurigana?: boolean },
): Promise<PostProcessResult> {
  try {
    const prompt = buildPrompt(
      segment.text,
      sourceLanguage,
      options.targetLanguage,
      options.enableAnnotations,
      options.enableFurigana,
    )
    const sourceLangName = getLanguageName(sourceLanguage)

    const response = await groq.chat.completions.create({
      model: GROQ_CHAT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a professional ${sourceLangName} language teacher producing shadowing-practice material. Provide accurate, faithful translations and normalizations — do not invent content beyond the source. Respond with valid JSON only.`,
        },
        { role: "user", content: prompt },
      ],
    })

    const responseText = response.choices[0]?.message?.content || ""
    const parsed = parseGroqResponse(responseText)

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
  } catch {
    return {
      originalText: segment.text,
      normalizedText: segment.text,
      translation: "",
      annotations: [],
      furigana: "",
      start: segment.start,
      end: segment.end,
      segmentIndex: segment.segmentIndex,
    }
  }
}

async function batchProcessShortTexts(
  groq: ReturnType<typeof getGroqClient>,
  shortTextSegments: Array<{ text: string; start: number; end: number; segmentIndex: number }>,
  sourceLanguage: string,
  options: { targetLanguage?: string; enableAnnotations?: boolean; enableFurigana?: boolean },
): Promise<PostProcessResult[]> {
  if (shortTextSegments.length === 0) return []

  const sourceLangName = getLanguageName(sourceLanguage)
  const targetLangName = options.targetLanguage ? getLanguageName(options.targetLanguage) : null
  const wantFurigana = options.enableFurigana && sourceLanguage === "ja"

  try {
    const combinedText = shortTextSegments
      .map((seg, i) => `[SEGMENT_${i}] ${seg.text}`)
      .join("\n")

    const prompt = `You are processing ${shortTextSegments.length} independent ${sourceLangName} text segments for language learning. Each [SEGMENT_N] line is a SEPARATE sentence.\n\nSource: ${sourceLangName}\n${targetLangName ? `Target: ${targetLangName}` : ""}\n\nSegments:\n${combinedText}\n\nReturn JSON shape:\n{\n  "segments": [\n    {\n      "id": 0,\n      "normalizedText": "...",${targetLangName ? '\n      "translation": "..."' : ""}${wantFurigana ? ',\n      "furigana": "..."' : ""}\n    }\n  ]\n}`

    const response = await groq.chat.completions.create({
      model: GROQ_CHAT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a professional ${sourceLangName} language teacher. Translate and normalize each segment independently. Respond with valid JSON only.`,
        },
        { role: "user", content: prompt },
      ],
    })

    let cleanedText = response.choices[0]?.message?.content?.trim() || ""
    if (cleanedText.startsWith("```json")) cleanedText = cleanedText.slice(7)
    if (cleanedText.startsWith("```")) cleanedText = cleanedText.slice(3)
    if (cleanedText.endsWith("```")) cleanedText = cleanedText.slice(0, -3)

    const jsonStart = cleanedText.indexOf("{")
    const jsonEnd = cleanedText.lastIndexOf("}")
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1)
    }

    const batch = JSON.parse(cleanedText)

    if (batch.segments && Array.isArray(batch.segments)) {
      return shortTextSegments.map((original, i) => {
        const proc = batch.segments[i]
        return {
          originalText: original.text,
          normalizedText: proc?.normalizedText || original.text,
          translation: proc?.translation || "",
          annotations: proc?.annotations || [],
          furigana: proc?.furigana || "",
          start: original.start,
          end: original.end,
          segmentIndex: original.segmentIndex,
        }
      })
    }

    return shortTextSegments.map((seg) => ({
      originalText: seg.text,
      normalizedText: seg.text,
      translation: "",
      annotations: [],
      furigana: "",
      start: seg.start,
      end: seg.end,
      segmentIndex: seg.segmentIndex,
    }))
  } catch {
    return shortTextSegments.map((seg) => ({
      originalText: seg.text,
      normalizedText: seg.text,
      translation: "",
      annotations: [],
      furigana: "",
      start: seg.start,
      end: seg.end,
      segmentIndex: seg.segmentIndex,
    }))
  }
}

postprocessRoute.post("/", async (c) => {
  try {
    const apiKey = c.env.GROQ_API_KEY
    if (!apiKey) {
      return apiError({ code: "CONFIG_ERROR", message: "GROQ_API_KEY 未配置", statusCode: 500 })
    }

    const body = await c.req.json()
    const validation = postProcessSchema.safeParse(body)
    if (!validation.success) {
      return apiError({
        code: "VALIDATION_ERROR",
        message: "无效的请求数据",
        details: validation.error.format(),
        statusCode: 400,
      })
    }

    const { segments, language, targetLanguage, enableAnnotations, enableFurigana } = validation.data

    if (segments.length === 0) {
      return apiError({ code: "NO_SEGMENTS", message: "没有提供 segments", statusCode: 400 })
    }
    if (segments.length > 100) {
      return apiError({ code: "TOO_MANY_SEGMENTS", message: "最多 100 个 segments", statusCode: 400 })
    }

    const indexedSegments = segments.map((seg, i) => ({
      ...seg,
      segmentIndex: typeof seg.segmentIndex === "number" ? seg.segmentIndex : i,
    }))

    const groq = getGroqClient(apiKey)
    const SHORT_THRESHOLD = 50

    const shortTexts = indexedSegments.filter((s) => s.text.length <= SHORT_THRESHOLD)
    const longTexts = indexedSegments.filter((s) => s.text.length > SHORT_THRESHOLD)

    const results: PostProcessResult[] = []

    if (shortTexts.length > 0) {
      const batchResults = await batchProcessShortTexts(groq, shortTexts, language, {
        targetLanguage,
        enableAnnotations,
        enableFurigana,
      })
      results.push(...batchResults)
    }

    for (const segment of longTexts) {
      const result = await processSegment(groq, segment, language, {
        targetLanguage,
        enableAnnotations,
        enableFurigana,
      })
      results.push(result)
    }

    const ordered = indexResults(results, indexedSegments)
    return apiSuccess({ processedSegments: ordered.length, segments: ordered })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return apiError({ code: "INTERNAL_ERROR", message: `后处理失败: ${msg}`, statusCode: 500 })
  }
})

function indexResults(
  results: PostProcessResult[],
  segments: Array<{ text: string; start: number; end: number; segmentIndex: number }>,
): PostProcessResult[] {
  const byIndex = new Map<number, PostProcessResult>()
  for (const r of results) {
    byIndex.set(r.segmentIndex, r)
  }
  return segments.map((seg) =>
    byIndex.get(seg.segmentIndex) ?? {
      originalText: seg.text,
      normalizedText: seg.text,
      translation: "",
      annotations: [],
      furigana: "",
      start: seg.start,
      end: seg.end,
      segmentIndex: seg.segmentIndex,
    },
  )
}
