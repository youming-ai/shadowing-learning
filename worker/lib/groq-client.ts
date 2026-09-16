import Groq from 'groq-sdk'

/**
 * 按 API key 缓存客户端。
 *
 * 早期实现是 `if (!_client) _client = new Groq({apiKey})`：**只用第一次的 key**，
 * 之后即使 `GROQ_API_KEY` 轮换了，只要 isolate 还活着就继续用旧 key ——
 * 表现是"改了密钥但线上仍报鉴权失败"，且很难排查。
 * 现在缓存键就是 key 本身，轮换后立刻生效。
 */
let cachedKey: string | null = null
let cachedClient: Groq | null = null

export function getGroqClient(apiKey: string): Groq {
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new Groq({ apiKey })
    cachedKey = apiKey
  }
  return cachedClient
}
