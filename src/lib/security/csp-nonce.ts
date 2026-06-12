// Server-only module: AsyncLocalStorage is not available in the browser
let nonceStorage: import('node:async_hooks').AsyncLocalStorage<string> | null = null

async function getNonceStorage() {
  if (typeof window !== 'undefined') return null
  if (!nonceStorage) {
    const { AsyncLocalStorage } = await import('node:async_hooks')
    nonceStorage = new AsyncLocalStorage<string>()
  }
  return nonceStorage
}

export async function runWithCspNonce<T>(nonce: string, fn: () => T): Promise<T> {
  const storage = await getNonceStorage()
  if (!storage) return fn()
  return storage.run(nonce, fn)
}

export function getCspNonce(): string | undefined {
  // 浏览器端不需要 nonce（CSP 由服务端下发并校验）
  if (typeof window !== 'undefined') return undefined
  // 服务端：读取 runWithCspNonce 已为本请求懒初始化的 AsyncLocalStorage 实例。
  // getStore() 本身是同步的——改 async 只是为了把 node:async_hooks 的 import 挡在浏览器 bundle 外；
  // 实例一旦由 runWithCspNonce 建立并以 storage.run() 包住整个渲染，同步读取即可拿到本请求的 nonce。
  return nonceStorage?.getStore()
}

export function createCspNonce(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export function buildContentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'nonce-${nonce}' https://www.clarity.ms https://www.youtube.com`
    : `script-src 'self' 'nonce-${nonce}' https://www.clarity.ms https://www.youtube.com`

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' blob: data: https:",
    "media-src 'self' blob:",
    "connect-src 'self' https://api.groq.com https://www.clarity.ms",
    // YouTube IFrame Player（嵌入 host 用 nocookie，iframe_api/widgetapi 脚本来自 www.youtube.com）
    'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
    "frame-ancestors 'none'",
  ].join('; ')
}
