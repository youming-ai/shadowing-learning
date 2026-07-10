'use client'

import { useEffect } from 'react'
import { AccountSection } from '~/components/features/settings/page/AccountSection'
import { ProUpgradeSection } from '~/components/features/settings/page/ProUpgradeSection'
import { SettingsLayout } from '~/components/features/settings/SettingsLayout'

export function AccountPage() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const scrollToHash = () => {
      const { hash } = window.location
      if (!hash) {
        return
      }

      requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(hash)
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    }

    scrollToHash()
    window.addEventListener('hashchange', scrollToHash)
    return () => window.removeEventListener('hashchange', scrollToHash)
  }, [])

  // Auth / subscription / usage stats land with Phase 3 (server accounts).

  return (
    <SettingsLayout>
      <div className="space-y-8">
        <AccountSection />
        <ProUpgradeSection />
      </div>
    </SettingsLayout>
  )
}

export default AccountPage
