import { createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import {
  buildContentSecurityPolicy,
  createCspNonce,
  runWithCspNonce,
} from '~/lib/security/csp-nonce'

const securityHeaders = createMiddleware({ type: 'request' }).server(async ({ next }) => {
  const nonce = createCspNonce()
  const result = await runWithCspNonce(nonce, () => next())

  setResponseHeader('Content-Security-Policy', buildContentSecurityPolicy(nonce))
  setResponseHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  setResponseHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  setResponseHeader('X-Content-Type-Options', 'nosniff')
  setResponseHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  return result
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}))
