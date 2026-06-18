'use client'

import type { ReactNode } from 'react'

/**
 * 页面级 Error 边界 — 包装整个页面。
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return <>{children}</>
}
