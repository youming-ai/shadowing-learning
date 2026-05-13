'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '~/components/layout/contexts/ThemeContext'

interface ThemeInfo {
  currentTheme: string
  dataTheme: string | null
  className: string
  systemPreference: string
  cssVars: Record<string, string>
  visualState: {
    bodyBg: string
    bodyColor: string
  }
}

export function ThemeDebugger() {
  const { theme } = useTheme()
  const [themeInfo, setThemeInfo] = useState<ThemeInfo | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const updateThemeInfo = () => {
      const root = document.documentElement
      const bodyStyle = getComputedStyle(document.body)
      const computedStyle = getComputedStyle(root)

      const cssVars: Record<string, string> = {}
      const importantVars = [
        '--text-primary',
        '--text-secondary',
        '--text-tertiary',
        '--text-muted',
        '--surface-base',
        '--surface-card',
        '--surface-muted',
        '--color-primary',
        '--border-default',
        '--border-focus',
        '--brand-500',
        '--brand-600',
        '--state-success-text',
        '--state-error-text',
        '--state-warning-text',
        '--player-accent-color',
        '--player-highlight-bg',
        '--shadow-md',
        '--shadow-lg',
      ]

      for (const varName of importantVars) {
        cssVars[varName] = computedStyle.getPropertyValue(varName).trim()
      }

      setThemeInfo({
        currentTheme: theme,
        dataTheme: root.getAttribute('data-theme'),
        className: root.className,
        systemPreference: window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light',
        cssVars,
        visualState: {
          bodyBg: bodyStyle.backgroundColor,
          bodyColor: bodyStyle.color,
        },
      })
    }

    updateThemeInfo()

    // 监听变化
    const observer = new MutationObserver(() => {
      updateThemeInfo()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
      subtree: false,
      childList: false,
    })

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleMediaChange = () => updateThemeInfo()
    mediaQuery.addEventListener('change', handleMediaChange)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  }, [theme])

  if (!isVisible || process.env.NODE_ENV !== 'development') {
    return null
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getContrastRating = (textColor: string, bgColor: string) => {
    // Simplified对比度Check
    const isTextLight =
      textColor.includes('255') || textColor.includes('#f8fafc') || textColor.includes('#e0e0e0')
    const isBgDark =
      bgColor.includes('0, 0, 0') || bgColor.includes('#0f172a') || bgColor.includes('#1e293b')

    return (isTextLight && isBgDark) || (!isTextLight && !isBgDark) ? 'Good' : 'Poor'
  }

  const textColor = themeInfo?.cssVars['--text-primary'] || ''
  const bgColor = themeInfo?.cssVars['--surface-base'] || ''
  const contrastRating = getContrastRating(textColor, bgColor)

  return (
    <div className="fixed top-4 right-4 z-50 bg-background border border-border rounded-lg p-4 max-w-sm shadow-lg">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">🎨 Theme Debugger</h3>
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <strong>Current Theme:</strong> {themeInfo?.currentTheme}
          </div>
          <div>
            <strong>Data Theme:</strong> {themeInfo?.dataTheme || 'null'}
          </div>
          <div>
            <strong>Resolved:</strong> {themeInfo?.systemPreference}
          </div>
          <div>
            <strong>Classes:</strong> {themeInfo?.className || 'none'}
          </div>
          <div>
            <strong>Contrast:</strong>
            <span className={contrastRating === 'Good' ? 'text-green-600' : 'text-red-600'}>
              {contrastRating}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <h4 className="font-medium text-foreground">Key CSS Variables:</h4>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div>
              <span className="text-muted-foreground">Text:</span>
              <div
                className="w-6 h-6 rounded border border-border"
                style={{ backgroundColor: textColor }}
                title="Text Primary Color"
              />
            </div>
            <div>
              <span className="text-muted-foreground">Surface:</span>
              <div
                className="w-6 h-6 rounded border border-border"
                style={{ backgroundColor: bgColor }}
                title="Surface Base Color"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <h4 className="font-medium text-foreground">Debug Actions:</h4>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(JSON.stringify(themeInfo, null, 2))}
              className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded"
            >
              Copy Info
            </button>
            <button
              type="button"
              onClick={() => {
                if (themeInfo) {
                  console.log('Theme Debug Info:', themeInfo)
                }
              }}
              className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded"
            >
              Log to Console
            </button>
            <button
              type="button"
              onClick={() => {
                // 强制重新应用当前主题
                const root = document.documentElement
                root.setAttribute('data-theme', themeInfo?.dataTheme || 'dark')
              }}
              className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded"
            >
              Force Apply
            </button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>💡 Check browser console for detailed theme switching logs</p>
        </div>
      </div>
    </div>
  )
}

// 开发环境快捷键显示/隐藏调试器
export function ThemeDebuggerToggle() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + T
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 't') {
        event.preventDefault()
        setIsVisible(!isVisible)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible])

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <>
      {isVisible && <ThemeDebugger />}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="px-2 py-1 text-xs bg-muted/80 hover:bg-muted text-muted-foreground rounded"
          title="Toggle Theme Debugger (Ctrl+Shift+T)"
        >
          🎨
        </button>
      </div>
    </>
  )
}
