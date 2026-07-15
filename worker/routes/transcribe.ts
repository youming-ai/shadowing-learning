import { Hono } from "hono"
import type { Env } from "../lib/types"
import { apiError, apiSuccess } from "../lib/api-response"
import { processTranscription } from "../lib/groq-whisper"

export const transcribeRoute = new Hono<{ Bindings: Env }>()

transcribeRoute.post("/", async (c) => {
  try {
    const language = c.req.query("language") ?? "en"

    const formData = await c.req.formData()
    const audioFile = formData.get("audio") ?? formData.get("file")

    if (!audioFile || typeof audioFile === "string") {
      return apiError({ code: "VALIDATION_ERROR", message: "需要音频文件", statusCode: 400 })
    }

    const result = await processTranscription(audioFile, language, c.env.GROQ_API_KEY)

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
