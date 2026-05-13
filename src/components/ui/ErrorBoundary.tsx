'use client'

import { AlertTriangle, Bug, Copy, RefreshCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Separator } from '~/components/ui/separator'
import { Textarea } from '~/components/ui/textarea'
import {
  getLocalErrorLogs,
  handleError,
  showErrorToast,
  showSuccessToast,
} from '~/lib/utils/error-handler'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  fallbackMessage?: string
  showDetails?: boolean
  allowReset?: boolean
  allowReport?: boolean
  maxErrors?: number
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorCount: number
  lastErrorTime: number
}

/** * Error边界component - 捕获子componentinError并显示友好Error信息*/
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: 0,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state 使下一次渲染能够显示降级后 UI
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // CheckError频率限制
    const now = Date.now()
    const timeSinceLastError = now - this.state.lastErrorTime
    const maxErrors = this.props.maxErrors || 10

    // If在5seconds内Error次数超过限制，忽略后续Error
    if (timeSinceLastError < 5000 && this.state.errorCount >= maxErrors) {
      return
    }

    // recordError
    handleError(error, `ErrorBoundary.${this.getDisplayName()}`)

    // 调用外部Errorprocessors
    this.props.onError?.(error, errorInfo)

    // Update state
    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: timeSinceLastError < 5000 ? prevState.errorCount + 1 : 1,
      lastErrorTime: now,
    }))
  }

  // Getcomponent显示name
  private getDisplayName(): string {
    return 'ErrorBoundary'
  }

  // 复制Error信息To剪贴板
  private async copyErrorToClipboard(): Promise<void> {
    try {
      const errorInfo = {
        message: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }

      await navigator.clipboard.writeText(JSON.stringify(errorInfo, null, 2))
      showSuccessToast('错误信息已复制到剪贴板')
    } catch (_err) {
      showErrorToast('复制失败，请手动复制错误信息')
    }
  }

  // 导出Error日志
  private exportErrorLogs(): void {
    const logs = getLocalErrorLogs()
    const dataStr = JSON.stringify(logs, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement('a')
    link.href = url
    link.download = `error-logs-${new Date().toISOString()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: 0,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  // GetError详情component
  private renderErrorDetails(): ReactNode {
    const { showDetails = true } = this.props
    const { error, errorInfo } = this.state

    if (!showDetails || !error) {
      return null
    }

    return (
      <div className="space-y-4">
        <div className="rounded-md bg-muted p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="mb-2 font-medium text-muted-foreground text-sm">
                错误详情: {error.message}
              </p>
              {error.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-muted-foreground text-sm hover:text-foreground">
                    错误堆栈
                  </summary>
                  <pre className="mt-2 max-h-40 scrollable rounded-md bg-muted p-3 text-xs">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={this.copyErrorToClipboard} className="ml-2">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {errorInfo && (
          <details className="mt-4">
            <summary className="cursor-pointer text-muted-foreground text-sm hover:text-foreground">
              组件堆栈信息
            </summary>
            <pre className="mt-2 max-h-40 scrollable rounded-md bg-muted p-3 text-xs">
              {errorInfo.componentStack}
            </pre>
          </details>
        )}
      </div>
    )
  }

  // GetErroroperations按钮
  private renderErrorActions(): ReactNode {
    const { allowReset = true, allowReport = true } = this.props

    return (
      <div className="flex flex-wrap gap-2">
        {allowReset && (
          <Button onClick={this.handleReset} variant="outline" className="flex-1">
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        )}
        <Button onClick={this.handleReload} className="flex-1">
          重新加载页面
        </Button>
        {allowReport && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1">
                <Bug className="mr-2 h-4 w-4" />
                报告问题
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>报告错误</DialogTitle>
                <DialogDescription>
                  您可以将错误信息发送给我们，帮助我们改进应用。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  value={`错误信息：${this.state.error?.message}
错误时间：${new Date().toLocaleString()}
页面URL：${window.location.href}
浏览器信息：${navigator.userAgent}
错误堆栈：${this.state.error?.stack || '无'}
组件堆栈：${this.state.errorInfo?.componentStack || '无'}`}
                  readOnly
                  className="min-h-[300px] font-mono text-xs"
                />
                <div className="flex gap-2">
                  <Button onClick={this.copyErrorToClipboard} variant="outline" className="flex-1">
                    <Copy className="mr-2 h-4 w-4" />
                    复制错误信息
                  </Button>
                  <Button onClick={this.exportErrorLogs} variant="outline" className="flex-1">
                    导出错误日志
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    )
  }

  render() {
    const { fallback, fallbackMessage = '应用程序遇到了一个意外错误。我们已经记录了这个问题。' } =
      this.props
    const { hasError, errorCount } = this.state

    if (hasError) {
      // If提供了自定义 fallback，则使用它
      if (fallback) {
        return fallback
      }

      // 默认Error UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-2xl shadow-lg">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <div className="space-y-2">
                <CardTitle className="font-bold text-xl">出现了一个错误</CardTitle>
                <CardDescription className="text-base">{fallbackMessage}</CardDescription>
                {errorCount > 1 && (
                  <Badge variant="secondary" className="mt-2">
                    第 {errorCount} 次错误
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {this.renderErrorDetails()}
              <Separator />
              {this.renderErrorActions()}

              {process.env.NODE_ENV === 'development' && (
                <div className="mt-6 rounded-md border border-yellow-200 bg-yellow-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline" className="border-yellow-300 text-yellow-700">
                      开发模式
                    </Badge>
                    <span className="font-medium text-sm text-yellow-700">
                      详细的错误信息将在下方显示
                    </span>
                  </div>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-yellow-700 hover:text-yellow-800">
                        查看完整错误堆栈
                      </summary>
                      <pre className="mt-2 max-h-60 scrollable rounded-md bg-yellow-100 p-3 text-xs text-yellow-900">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

/** * 页面级Error边界 - 包装整个页面*/
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallbackMessage="页面出现错误，请尝试刷新页面"
      onError={(_error, _errorInfo) => {
        // 这里可以集成Error监控服务
        // console.error('Page error:', error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

/** * component级Error边界 - 包装特定component*/
export function ComponentErrorBoundary({
  children,
  fallback,
  fallbackMessage,
}: {
  children: ReactNode
  fallback?: ReactNode
  fallbackMessage?: string
}) {
  return (
    <ErrorBoundary
      fallback={fallback}
      fallbackMessage={fallbackMessage}
      showDetails={false}
      allowReport={false}
    >
      {children}
    </ErrorBoundary>
  )
}

/** * 轻量级Error边界 - Used for小型component*/
export function LightErrorBoundary({
  children,
  fallback,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  return (
    <ErrorBoundary
      fallback={
        fallback || (
          <div className="p-4 text-center text-muted-foreground">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
            <p className="text-sm">组件加载失败</p>
          </div>
        )
      }
      showDetails={false}
      allowReport={false}
      allowReset={false}
    >
      {children}
    </ErrorBoundary>
  )
}

/** * API Error边界 - Used forAPIoperations相关component*/
export function ApiErrorBoundary({
  children,
  fallbackMessage = '网络请求失败，请检查网络连接后重试',
}: {
  children: ReactNode
  fallbackMessage?: string
}) {
  return (
    <ErrorBoundary
      fallbackMessage={fallbackMessage}
      showDetails={false}
      allowReport={true}
      maxErrors={5}
    >
      {children}
    </ErrorBoundary>
  )
}

/** * 高阶component - ascomponentAddError边界*/
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    fallback?: ReactNode
    fallbackMessage?: string
    showDetails?: boolean
    allowReset?: boolean
    allowReport?: boolean
  } = {},
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...options}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
