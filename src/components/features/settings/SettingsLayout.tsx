'use client'

import type { ReactNode } from 'react'

interface SettingsLayoutProps {
  children: ReactNode
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">{children}</div>
    </main>
  )
}
