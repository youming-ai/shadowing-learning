/**
 * 后处理内核 —— 客户端（BYOK 直连）与 Worker（服务器额度）共用的**唯一**一份实现。
 *
 * 为什么放在 `shared/` 而不是 `src/`：
 * 这段代码两个运行时都要跑。以前它只存在于 Worker 里；一旦支持 BYOK，客户端也必须
 * 能自己构造同一套 prompt，而两份拷贝必然漂移（本仓库已经吃过文档/类型漂移的亏）。
 * 因此把它提到运行时中立的目录，两边都**相对**导入：
 * - Worker：`../../shared/ai/postprocess-core`（wrangler 不认 `~` 别名，只能用相对路径）
 * - 客户端：`../../../shared/ai/postprocess-core` 或用 `~shared/*` 别名
 *
 * 本模块必须是纯的：不碰 DOM、不碰 fetch、不碰任何运行时 API，只接收一个注入的
 * `ChatFn`。这样两种传输（Groq SDK / 浏览器直连供应商）共享全部 prompt 与解析逻辑，
 * 且可单测。
 *
 * 注意：prompt 文本是从原 Worker 实现**逐字**搬过来的。改文案要意识到它会同时影响
 * 服务器路径与 BYOK 路径。
 */

/** 服务器路径使用的 Groq 模型（BYOK 的模型在 `src/lib/ai/catalog.ts` 里按供应商声明）。*/
export const DEFAULT_CHAT_MODEL = 'openai/gpt-oss-120b'

/** 逐条处理的采样温度。批处理与单条都用它，保持两条路径输出风格一致。*/
export const POSTPROCESS_TEMPERATURE = 0.2

/** 短文本阈值：≤ 此长度走批处理（一次请求多条），更长的逐条处理。*/
export const SHORT_TEXT_THRESHOLD = 50

const LANGUAGE_NAMES: Record<string, string> = {
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  zh: 'Chinese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
}

export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code
}

export interface PostProcessSegmentInput {
  text: string
  start: number
  end: number
  segmentIndex: number
}

export interface PostProcessResult {
  originalText: string
  normalizedText: string
  translation: string | undefined
  annotations: string[] | undefined
  furigana?: string
  start: number
  end: number
  segmentIndex: number
}

export interface PostProcessOptions {
  language: string
  targetLanguage?: string
  enableAnnotations?: boolean
  enableFurigana?: boolean
}

/** 一次对话请求。传输层负责把它映射成各家供应商的线上格式。*/
export interface ChatRequest {
  system: string
  user: string
  temperature: number
  /**
   * 提示传输层尽量启用 JSON 输出模式。
   * OpenAI 系有 `response_format`；Anthropic 没有，只能靠 prompt 约束 + 宽容解析。
   */
  jsonMode: boolean
}

/** 返回模型的原始文本。抛错表示这一次调用失败，由调用方决定降级策略。*/
export type ChatFn = (req: ChatRequest) => Promise<string>

export function buildSegmentPrompt(
  text: string,
  sourceLanguage: string,
  targetLanguage?: string,
  enableAnnotations = true,
  enableFurigana = true,
): string {
  const sourceLangName = getLanguageName(sourceLanguage)
  const targetLangName = targetLanguage ? getLanguageName(targetLanguage) : undefined

  let prompt = `You are a professional language teachers specializing in ${sourceLangName} language learning and shadowing practice.\n\nTask: Process the following ${sourceLangName} text for language learners.\n\nInput:\n${text}\n\nRequirements:\n1. Normalize the text (remove filler words, fix grammar, etc.)\n2. ${targetLangName ? `Provide translation to ${targetLangName}` : 'Keep original language'}`

  if (enableAnnotations) {
    prompt += '\n3. Add grammatical and cultural annotations'
  }

  if (enableFurigana && sourceLanguage === 'ja') {
    prompt += '\n4. Include furigana for kanji'
  }

  prompt +=
    '\n\nOutput format:\n{\n  "normalizedText": "Clean, normalized text",\n  "translation": "Translation if requested",\n  "annotations": ["List of annotations"],\n  "furigana": "Text with furigana if applicable",\n  "terminology": {"term": "reading and definition"}\n}'

  return prompt
}

export function buildSegmentSystemPrompt(sourceLanguage: string): string {
  const sourceLangName = getLanguageName(sourceLanguage)
  return `You are a professional ${sourceLangName} language teacher producing shadowing-practice material. Provide accurate, faithful translations and normalizations — do not invent content beyond the source. Respond with valid JSON only.`
}

export function buildBatchSystemPrompt(sourceLanguage: string): string {
  const sourceLangName = getLanguageName(sourceLanguage)
  return `You are a professional ${sourceLangName} language teacher. Translate and normalize each segment independently. Respond with valid JSON only.`
}

/** 批处理的 user prompt。注意 JSON 形状里的字段是按开关**拼**出来的。*/
export function buildBatchPrompt(
  count: number,
  combinedText: string,
  sourceLanguage: string,
  options: PostProcessOptions,
): string {
  const sourceLangName = getLanguageName(sourceLanguage)
  const targetLangName = options.targetLanguage ? getLanguageName(options.targetLanguage) : null
  const wantFurigana = Boolean(options.enableFurigana) && sourceLanguage === 'ja'
  const wantAnnotations = options.enableAnnotations ?? false

  return `You are processing ${count} independent ${sourceLangName} text segments for language learning. Each [SEGMENT_N] line is a SEPARATE sentence.\n\nSource: ${sourceLangName}\n${targetLangName ? `Target: ${targetLangName}` : ''}\n\nSegments:\n${combinedText}\n\nReturn JSON shape:\n{\n  "segments": [\n    {\n      "id": 0,\n      "normalizedText": "...",${targetLangName ? '\n      "translation": "..."' : ''}${wantAnnotations ? ',\n      "annotations": ["grammatical/cultural notes, if any"]' : ''}${wantFurigana ? ',\n      "furigana": "..."' : ''}\n    }\n  ]\n}`
}

/** 去掉 ``` 围栏并截取最外层 JSON 对象。模型经常不按 `response_format` 出牌。*/
export function stripFence(s: string): string {
  let t = s.trim()
  if (t.startsWith('```json')) t = t.slice(7)
  if (t.startsWith('```')) t = t.slice(3)
  if (t.endsWith('```')) t = t.slice(0, -3)
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a !== -1 && b !== -1 && b > a) t = t.substring(a, b + 1)
  return t
}

export function parsePostProcessJson(responseText: string): {
  normalizedText: string
  translation?: string
  annotations?: string[]
  furigana?: string
} {
  try {
    const cleanedText = stripFence(responseText)
    const payload = JSON.parse(cleanedText)
    return {
      normalizedText: payload.normalizedText || payload.text || '',
      translation: payload.translation,
      annotations: payload.annotations || [],
      furigana: payload.furigana,
    }
  } catch {
    return { normalizedText: responseText || '', translation: '', annotations: [], furigana: '' }
  }
}

/** 降级结果：保留原文，翻译留空。宁可少给内容，也不要给错内容。*/
export function fallbackResult(seg: PostProcessSegmentInput): PostProcessResult {
  return {
    originalText: seg.text,
    normalizedText: seg.text,
    translation: '',
    annotations: [],
    furigana: '',
    start: seg.start,
    end: seg.end,
    segmentIndex: seg.segmentIndex,
  }
}

/**
 * 标记**系统性失败**：鉴权、配额、端点/模型配置、网络或跨域不可达。
 * 这类失败意味着"这个引擎现在整体不可用"，一条都做不成，必须向上冒泡让用户看见。
 *
 * 由**传输层**决定什么算系统性（它才知道自己的语义），内核只负责不吞掉它：
 * 若在这里降级成"保留原文"，上层会把空翻译当成功写库并标 completed ——
 * 用户看不到任何错误、改了 key 也不会自动重试，等于静默产出损坏结果。
 *
 * 与之相对，**可重试**失败（429 / 408 / 5xx）抛 `RetryableEngineError` 交给编排退避重试；
 * 只有既非系统性、也非可重试的失败（例如某条内容解析不出来）才就地降级。
 */
export class FatalEngineError extends Error {
  readonly code: string

  constructor(message: string, code = 'ENGINE_UNAVAILABLE') {
    super(message)
    this.name = 'FatalEngineError'
    this.code = code
  }
}

export function isFatalEngineError(error: unknown): error is FatalEngineError {
  return error instanceof FatalEngineError
}

/**
 * 标记**可重试**失败：限流（429）、临时性服务端错误（5xx / 408）。
 * 与 `FatalEngineError` 的区别是"再试一次可能就成功"。
 *
 * 同样由传输层声明（只有它知道 HTTP 语义），内核负责不吞掉它，
 * 由分片编排做退避重试。`retryAfterSec` 来自服务端的 `Retry-After` 头，
 * 有它时必须听服务端的，而不是用我们自己的退避曲线。
 *
 * 为什么不就地降级：这类失败是**整片**的（限流是按请求计的），
 * 降级会把一片空翻译写成"成功"，正是我们要避免的静默损坏。
 */
export class RetryableEngineError extends Error {
  /** 服务端要求的等待秒数；无该信息时为 null。 */
  readonly retryAfterSec: number | null

  constructor(message: string, retryAfterSec: number | null = null) {
    super(message)
    this.name = 'RetryableEngineError'
    this.retryAfterSec = retryAfterSec
  }
}

export function isRetryableEngineError(error: unknown): error is RetryableEngineError {
  return error instanceof RetryableEngineError
}

/**
 * 降级规则：
 * - `FatalEngineError`（系统性）→ 冒泡
 * - 其它错误（单次调用失败）→ 就地降级为"保留原文"
 */
function degradeOrRethrow(error: unknown): boolean {
  // 系统性失败与可重试失败都必须冒泡：前者要让用户看到，后者要交给编排重试。
  if (isFatalEngineError(error) || isRetryableEngineError(error)) throw error
  return true // 允许就地降级
}

/**
 * 错误语义（**别把两者混起来**）：
 *
 * - **系统性失败**：传输层抛 `FatalEngineError`（见其文档），内核**必须让它冒泡**。
 * - **内容级失败**：模型给了文本但不是合法 JSON → 就地降级为"保留原文"，其余照常。
 */
async function processOne(
  seg: PostProcessSegmentInput,
  options: PostProcessOptions,
  chat: ChatFn,
): Promise<PostProcessResult> {
  const user = buildSegmentPrompt(
    seg.text,
    options.language,
    options.targetLanguage,
    options.enableAnnotations,
    options.enableFurigana,
  )
  let responseText: string
  try {
    responseText = await chat({
      system: buildSegmentSystemPrompt(options.language),
      user,
      temperature: POSTPROCESS_TEMPERATURE,
      jsonMode: true,
    })
  } catch (error) {
    degradeOrRethrow(error)
    return fallbackResult(seg)
  }

  // parsePostProcessJson 自身宽容，不会抛
  const parsed = parsePostProcessJson(responseText)
  return {
    originalText: seg.text,
    normalizedText: parsed.normalizedText,
    translation: parsed.translation,
    annotations: parsed.annotations,
    furigana: parsed.furigana,
    start: seg.start,
    end: seg.end,
    segmentIndex: seg.segmentIndex,
  }
}

async function processBatch(
  batch: PostProcessSegmentInput[],
  options: PostProcessOptions,
  chat: ChatFn,
): Promise<PostProcessResult[]> {
  if (batch.length === 0) return []

  const combinedText = batch.map((seg, i) => `[SEGMENT_${i}] ${seg.text}`).join('\n')
  let responseText: string
  try {
    responseText = await chat({
      system: buildBatchSystemPrompt(options.language),
      user: buildBatchPrompt(batch.length, combinedText, options.language, options),
      temperature: POSTPROCESS_TEMPERATURE,
      jsonMode: true,
    })
  } catch (error) {
    degradeOrRethrow(error)
    return batch.map(fallbackResult)
  }

  // 只有"解析不出形状"这一种内容级失败才整批降级
  try {
    const cleanedText = stripFence(responseText)
    const parsedBatch = JSON.parse(cleanedText)

    if (parsedBatch.segments && Array.isArray(parsedBatch.segments)) {
      // 按**位置**映射，与线上既有行为一致（prompt 虽然要求返回 "id"，但这里不依赖它）。
      // ponytail: 模型若打乱顺序会错配。改成优先信任 id 是行为变更，留作单独一次改动。
      return batch.map((original, i) => {
        const proc = parsedBatch.segments[i]
        return {
          originalText: original.text,
          normalizedText: proc?.normalizedText || original.text,
          translation: proc?.translation || '',
          annotations: proc?.annotations || [],
          furigana: proc?.furigana || '',
          start: original.start,
          end: original.end,
          segmentIndex: original.segmentIndex,
        }
      })
    }

    return batch.map(fallbackResult)
  } catch {
    // 模型给的不是合法 JSON → 这一批全部降级（内容级失败，不是传输失败）
    return batch.map(fallbackResult)
  }
}

/**
 * 处理一个分片：短文本合批、长文本逐条，最后按 `segmentIndex` 归位。
 *
 * 分流策略照搬原 Worker 实现：长文本**串行**处理（避免并发撞限流）。
 *
 * 失败语义见 `processOne` 上方的说明：**传输/鉴权错误会直接抛出**，由上层分片编排
 * 判定失败并让用户看到；只有内容级失败（模型输出非法 JSON）才就降级为保留原文。
 */
export async function processSegmentsWithChat(
  segments: PostProcessSegmentInput[],
  options: PostProcessOptions,
  chat: ChatFn,
): Promise<PostProcessResult[]> {
  const shortTexts = segments.filter((s) => s.text.length <= SHORT_TEXT_THRESHOLD)
  const longTexts = segments.filter((s) => s.text.length > SHORT_TEXT_THRESHOLD)

  const results: PostProcessResult[] = []

  if (shortTexts.length > 0) {
    results.push(...(await processBatch(shortTexts, options, chat)))
  }

  for (const segment of longTexts) {
    results.push(await processOne(segment, options, chat))
  }

  return indexResults(results, segments)
}

/** 按 segmentIndex 归位；缺失的用降级结果补齐，保证与输入等长且同序。*/
export function indexResults(
  results: PostProcessResult[],
  segments: PostProcessSegmentInput[],
): PostProcessResult[] {
  const byIndex = new Map<number, PostProcessResult>()
  for (const r of results) {
    byIndex.set(r.segmentIndex, r)
  }
  return segments.map((seg) => byIndex.get(seg.segmentIndex) ?? fallbackResult(seg))
}
