'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

interface BeforeInstallPromptEvent extends Event {
  prompt(): void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWARegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    // 无论接受还是取消，这个 prompt 事件都已失效，必须丢弃
    setDeferredPrompt(null)
  }, [deferredPrompt])

  /**
   * Service Worker 注册：**只在挂载时执行一次**。
   *
   * 以前它与下面的安装/网络事件写在同一个 effect 里，而该 effect 依赖 `handleInstallClick`，
   * 后者随 `deferredPrompt` 变化 —— 于是每次安装提示出现或消失都会重新执行，
   * 在同一个 registration 上**重复挂 `updatefound` 监听**，同一个版本更新会弹多次 toast。
   */
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // 主动查一次更新：只靠浏览器自身的检查周期，用户可能长时间停留在旧版本
        registration.update().catch(() => {})

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              toast.info('New version available! Restart to update.', {
                action: { label: 'Update', onClick: () => window.location.reload() },
                duration: 10000,
              })
            }
          })
        })
      })
      .catch(() => {
        // 注册失败不阻断应用运行
      })
  }, [])

  /** 安装提示与网络状态：与 SW 注册分开，避免上面的重复监听问题。 */
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferredPrompt(e)
      toast.info('安装影子跟读应用以获得更好的体验！', {
        action: { label: 'Install', onClick: () => handleInstallClick() },
        duration: 8000,
      })
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      toast.success('App installed successfully!')
    }

    const handleOnline = () => {
      toast.success('Connection restored!', { duration: 3000 })
    }

    const handleOffline = () => {
      toast.warning('You are now offline. Some features may be limited.', {
        duration: 5000,
      })
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleInstallClick])

  return null
}
