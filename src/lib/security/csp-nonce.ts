import { AsyncLocalStorage } from 'node:async_hooks'

const nonceStorage = new AsyncLocalStorage<string>()

export function runWithCspNonce<T>(nonce: string, fn: () => T): T {
  return nonceStorage.run(nonce, fn)
}

export function getCspNonce(): string | undefined {
  return nonceStorage.getStore()
}

export function createCspNonce(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export function buildContentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'nonce-${nonce}' https://www.clarity.ms`
    : `script-src 'self' 'nonce-${nonce}' https://www.clarity.ms`

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' blob: data: https:",
    "media-src 'self' blob:",
    "connect-src 'self' https://api.groq.com https://www.clarity.ms",
    "frame-ancestors 'none'",
  ].join('; ')
}
