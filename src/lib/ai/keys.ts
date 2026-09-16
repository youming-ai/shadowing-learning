/**
 * BYOK 密钥与引擎选择的本地存储。
 *
 * ## 安全模型（请如实告知用户，不要含糊）
 *
 * - key 只落在**本机 localStorage**，命名空间 `shadowing.ai.*`。
 * - key **只**发往用户所选供应商的域名；我们的 Worker 永远收不到它。
 *   这一点由传输层保证（见 `transports.ts`），并有测试守着。
 * - 但 localStorage 与我们的页面**同源**：任何能在此源执行脚本的攻击（XSS、
 *   恶意依赖）都能读走 key。这是 BYOK 的固有代价，不是本实现的疏漏。
 *   因此 UI 必须明说"填自己的 key = 用自己的额度、并自行承担该风险"，
 *   同时默认路径（服务器额度）不需要用户交出任何密钥。
 *
 * 不把 key 放进 IndexedDB / 不进任何查询缓存 / 不写日志。
 */

import { SERVER_ENGINE_ID } from './catalog'

const NS = 'shadowing.ai'
const ENGINE_KEY = `${NS}.engine`
const MODEL_KEY = (providerId: string) => `${NS}.model.${providerId}`
const API_KEY = (providerId: string) => `${NS}.key.${providerId}`

function safeGet(key: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    // 隐私模式 / 配额异常：当作没有设置，而不是让整页崩掉
    return null
  }
}

function safeSet(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {
    // 写不进去就静默失败；调用方读回时自然会看到旧值
  }
}

function safeRemove(key: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {
    // 同上
  }
}

/** 当前选择的引擎；默认走服务器额度（用户零配置即可用）。*/
export function getSelectedEngineId(): string {
  return safeGet(ENGINE_KEY) || SERVER_ENGINE_ID
}

export function setSelectedEngineId(engineId: string): void {
  safeSet(ENGINE_KEY, engineId)
}

export function getStoredKey(providerId: string): string | null {
  const v = safeGet(API_KEY(providerId))
  return v && v.trim().length > 0 ? v : null
}

export function setStoredKey(providerId: string, apiKey: string): void {
  safeSet(API_KEY(providerId), apiKey.trim())
}

export function clearStoredKey(providerId: string): void {
  safeRemove(API_KEY(providerId))
}

/** 用户为某供应商选定的模型；未设置时由调用方回退到目录里的 defaultModel。*/
export function getStoredModel(providerId: string): string | null {
  const v = safeGet(MODEL_KEY(providerId))
  return v && v.trim().length > 0 ? v : null
}

export function setStoredModel(providerId: string, model: string): void {
  safeSet(MODEL_KEY(providerId), model.trim())
}

/** 清掉全部 BYOK 设置（"退出 BYOK"用）。不清服务器引擎选择之外的其它状态。*/
export function clearAllAiSettings(providerIds: readonly string[]): void {
  for (const id of providerIds) {
    safeRemove(API_KEY(id))
    safeRemove(MODEL_KEY(id))
  }
  safeRemove(ENGINE_KEY)
}

/**
 * 给 UI 展示用的掩码。只露头尾各 4 位，中间的字符数不泄漏真实长度。
 * 极短的 key 直接全掩，避免"掩码本身泄漏了 key"。
 */
export function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}${'•'.repeat(8)}${key.slice(-4)}`
}
