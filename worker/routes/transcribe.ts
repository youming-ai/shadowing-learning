import { Hono } from "hono"
import type { Env } from "../lib/types"
import { apiError, apiSuccess } from "../lib/api-response"
import { processTranscription } from "../lib/groq-whisper"

export const transcribeRoute = new Hono<{ Bindings: Env }>()

// 与 SUPPORTED_LANGUAGES（src/components/layout/contexts/TranscriptionLanguageContext.tsx）一致，
// 外加 "auto"：groq-whisper.ts 把它特判为不传 language 参数（Whisper 自动检测）。
const SUPPORTED_LANGUAGES = new Set(["auto", "zh-CN", "zh-TW", "en", "ja", "ko"])

transcribeRoute.post("/", async (c) => {
  try {
    const apiKey = c.env.GROQ_API_KEY
    if (!apiKey) {
      return apiError({ code: "CONFIG_ERROR", message: "GROQ_API_KEY 未配置", statusCode: 500 })
    }

    const rawLanguage = c.req.query("language")
    const language = rawLanguage && SUPPORTED_LANGUAGES.has(rawLanguage) ? rawLanguage : "en"

    const formData = await c.req.formData()
    const audioFile = formData.get("audio") ?? formData.get("file")

    if (!audioFile || typeof audioFile === "string") {
      return apiError({ code: "VALIDATION_ERROR", message: "需要音频文件", statusCode: 400 })
    }

    const result = await processTranscription(audioFile, language, apiKey)

    if (!result.success) {
      return result.error
    }

    return apiSuccess({
      status: "completed",
      text: result.data.text,
      language: result.data.language ?? language,
      duration: result.data.duration,
      segments: result.data.segments,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return apiError({ code: "INTERNAL_ERROR", message: `转录失败: ${msg}`, statusCode: 500 })
  }
})
