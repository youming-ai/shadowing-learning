/**
 * AI 供应商目录 —— **声明式数据**，不是代码分支。
 *
 * 竞品调研（docs/research/trancy-extension-analysis.md）里 Trancy 唯一值得重新实现的
 * 架构模式就是"版本化的供应商目录作数据"：新增一个供应商 = 加一条数据，而不是到处加 if。
 *
 * 本目录只包含我**实测过 CORS** 的供应商：这些端点在预检里返回
 * `access-control-allow-origin` 并允许 `authorization` 头，因此浏览器可以直连、
 * 用户的 key 不需要经过我们的服务器。加新供应商前请先做同样的预检，否则会做出一个
 * "看起来能用、一按就失败"的选项。
 *
 * 关于模型 ID：各家的模型名会随时间下架/改名，而我们的目录是**静态**的（没有像 Trancy
 * 那样的服务端目录可拉）。所以模型字段在 UI 里是**可自由编辑**的，这里的 `suggestedModels`
 * 只是预填建议，不是白名单。这样即使某个 ID 过时，用户也不会被卡住。
 */

export type AiProtocol = 'openai' | 'anthropic'

/** 不用自带 key、走我们服务器额度的引擎 id。 */
export const SERVER_ENGINE_ID = 'server'

export interface AiProvider {
  id: string
  /** 展示名（供应商自有品牌，不翻译） */
  label: string
  protocol: AiProtocol
  /** 直连端点：浏览器 → 供应商，key 不经过我们的 Worker */
  endpoint: string
  defaultModel: string
  suggestedModels: string[]
  /** 申请 key 的官方页面，给用户一个入口 */
  keysUrl: string
}

export const AI_PROVIDERS: readonly AiProvider[] = [
  {
    id: 'groq',
    label: 'Groq',
    protocol: 'openai',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    // 与我们服务器路径用的是同一个模型，两条链路的输出风格因此一致
    defaultModel: 'openai/gpt-oss-120b',
    suggestedModels: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile'],
    keysUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: ['gpt-4o-mini', 'gpt-4o'],
    keysUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    protocol: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-5-haiku-latest',
    suggestedModels: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
    keysUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai',
    endpoint: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-chat',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner'],
    keysUrl: 'https://platform.deepseek.com/api_keys',
  },
] as const

export function findProvider(id: string): AiProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id)
}

/** 该引擎是否需要用户自带 key（服务器引擎不需要）。*/
export function isBringYourOwn(engineId: string): boolean {
  return engineId !== SERVER_ENGINE_ID && findProvider(engineId) !== undefined
}
