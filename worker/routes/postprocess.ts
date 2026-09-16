import { Hono } from 'hono'
import z from 'zod'
import { DEFAULT_CHAT_MODEL, processSegmentsWithChat } from '../../shared/ai/postprocess-core'
import { apiError, apiSuccess } from '../lib/api-response'
import { getGroqClient } from '../lib/groq-client'
import type { Env } from '../lib/types'

const postProcessSchema = z.object({
  segments: z.array(
    z.object({
      text: z.string(),
      start: z.number(),
      end: z.number(),
      segmentIndex: z.number().optional(),
    }),
  ),
  language: z.string().optional().default('ja'),
  targetLanguage: z.string().optional().default('en'),
  enableAnnotations: z.boolean().optional().default(true),
  enableFurigana: z.boolean().optional().default(true),
})

export const postprocessRoute = new Hono<{ Bindings: Env }>()

/**
 * 服务器额度路径。
 *
 * 实际的 prompt、短/长文本分流与降级逻辑都在 `shared/ai/postprocess-core` ——
 * 与浏览器直连（BYOK）路径**共用同一份实现**，这里只负责：
 * 校验请求、拿服务器 secret 建 Groq 客户端、把"一次对话"接到共享内核上。
 *
 * 保持薄的原因：一旦 prompt 在这里另起一份，两条链路就会输出不同结果且无人察觉。
 */
postprocessRoute.post('/', async (c) => {
  try {
    const apiKey = c.env.GROQ_API_KEY
    if (!apiKey) {
      return apiError({ code: 'CONFIG_ERROR', message: 'GROQ_API_KEY 未配置', statusCode: 500 })
    }

    const body = await c.req.json()
    const validation = postProcessSchema.safeParse(body)
    if (!validation.success) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: '无效的请求数据',
        details: validation.error.format(),
        statusCode: 400,
      })
    }

    const { segments, language, targetLanguage, enableAnnotations, enableFurigana } =
      validation.data

    if (segments.length === 0) {
      return apiError({ code: 'NO_SEGMENTS', message: '没有提供 segments', statusCode: 400 })
    }
    if (segments.length > 100) {
      return apiError({
        code: 'TOO_MANY_SEGMENTS',
        message: '最多 100 个 segments',
        statusCode: 400,
      })
    }

    const indexedSegments = segments.map((seg, i) => ({
      ...seg,
      segmentIndex: typeof seg.segmentIndex === 'number' ? seg.segmentIndex : i,
    }))

    const groq = getGroqClient(apiKey)

    const ordered = await processSegmentsWithChat(
      indexedSegments,
      { language, targetLanguage, enableAnnotations, enableFurigana },
      async (req) => {
        const response = await groq.chat.completions.create({
          model: DEFAULT_CHAT_MODEL,
          temperature: req.temperature,
          response_format: req.jsonMode ? { type: 'json_object' } : undefined,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
        })
        return response.choices[0]?.message?.content || ''
      },
    )

    return apiSuccess({ processedSegments: ordered.length, segments: ordered })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return apiError({ code: 'INTERNAL_ERROR', message: `后处理失败: ${msg}`, statusCode: 500 })
  }
})
