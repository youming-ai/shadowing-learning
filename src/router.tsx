import { createRouter } from '@tanstack/react-router'
import { getCspNonce } from '~/lib/security/csp-nonce'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  // Thread the per-request CSP nonce into TanStack's SSR bootstrap <script>.
  // Without it the nonce'd CSP disables 'unsafe-inline', blocks window.$_TSR,
  // and hydration fails. Undefined on the client — harmless.
  const nonce = getCspNonce()
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    ssr: { nonce },
  })
  return router
}
