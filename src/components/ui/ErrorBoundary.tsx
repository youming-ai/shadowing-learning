'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * 页面级 Error 边界 — 包装整个页面，捕获未处理的渲染错误并显示降级 UI。
 */
export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PageErrorBoundary] Uncaught render error:', error, info.componentStack)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-error)' }}>
            页面出现错误
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            抱歉，页面渲染时发生了意外错误。请尝试刷新页面。
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre
              className="mt-2 max-w-lg overflow-auto rounded p-3 text-xs"
              style={{
                backgroundColor: 'var(--surface-card)',
                color: 'var(--text-primary)',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{
                backgroundColor: 'var(--surface-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
              }}
            >
              重试
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
