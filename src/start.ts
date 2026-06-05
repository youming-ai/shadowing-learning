import { createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'

const securityHeaders = createMiddleware({ type: 'request' }).server(async ({ next }) => {
  const result = await next()

  setResponseHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.clarity.ms",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' blob: data: https:",
      "media-src 'self' blob:",
      "connect-src 'self' https://api.groq.com https://www.clarity.ms",
      "frame-ancestors 'none'",
    ].join('; '),
  )
  setResponseHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  setResponseHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  setResponseHeader('X-Content-Type-Options', 'nosniff')
  setResponseHeader('X-Frame-Options', 'SAMEORIGIN')
  setResponseHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  return result
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}))
