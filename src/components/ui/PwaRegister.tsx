'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

interface BeforeInstallPromptEvent extends Event {
  prompt(): void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWARegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [, setShowInstallButton] = useState(false)

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      // User accepted the install prompt
    } else {
      // User dismissed the install prompt
    }

    setDeferredPrompt(null)
    setShowInstallButton(false)
  }, [deferredPrompt])

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New update available
                  toast.info('New version available! Restart to update.', {
                    action: {
                      label: 'Update',
                      onClick: () => window.location.reload(),
                    },
                    duration: 10000,
                  })
                }
              })
            }
          })
        })
        .catch((_registrationError) => {
          // Service worker registration failed
        })
    }

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallButton(true)

      toast.info('安装影子跟读应用以获得更好的体验！', {
        action: {
          label: 'Install',
          onClick: () => handleInstallClick(),
        },
        duration: 8000,
      })
    }

    // Handle app installed event
    const handleAppInstalled = () => {
      setShowInstallButton(false)
      toast.success('App installed successfully!')
    }

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Check if app i already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallButton(false)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [handleInstallClick])

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      toast.success('Connection restored!', { duration: 3000 })
    }

    const handleOffline = () => {
      toast.warning('You are now offline. Some features may be limited.', {
        duration: 5000,
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return null
}
