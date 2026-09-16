'use client'

import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Component, type ReactNode } from 'react'
import { Button } from '~/components/ui/button'
import { translateStandalone } from '~/lib/i18n/standalone'

interface ErrorInfo {
  componentStack: string
}

interface PlayerErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

interface PlayerErrorBoundaryProps {
  children: ReactNode
}

export default class PlayerErrorBoundary extends Component<
  PlayerErrorBoundaryProps,
  PlayerErrorBoundaryState
> {
  constructor(props: PlayerErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): PlayerErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md text-center">
            <div className="mb-6">
              <div className="mb-4 text-6xl">😵</div>
              <h1 className="mb-2 font-bold text-2xl text-foreground">
                {translateStandalone('player.errorTitle')}
              </h1>
              <p className="mb-6 text-muted-foreground">
                {this.state.error?.message || translateStandalone('player.unknownError')}
              </p>
            </div>

            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {translateStandalone('common.reload')}
              </Button>
              <Button onClick={() => window.history.back()} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                {translateStandalone('player.back')}
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-muted-foreground text-sm hover:text-foreground">
                  {translateStandalone('player.devDetails')}
                </summary>
                <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted p-4 text-xs">
                  {this.state.error?.stack}
                  {'\n\nComponent Stack:\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
