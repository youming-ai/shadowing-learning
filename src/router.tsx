import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

let _router: ReturnType<typeof createRouter> | null = null

export function getRouter() {
  if (!_router) {
    _router = createRouter({
      routeTree,
      scrollRestoration: true,
    })
  }
  return _router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
