'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'

interface ApiKeyErrorProps {
  onRetry?: () => void
}

export default function ApiKeyError({ onRetry }: ApiKeyErrorProps) {
  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--card-background)] border border-[var(--border-color)] rounded-lg p-6">
        <div className="flex items-center gap-3 text-[var(--state-error-text)] mb-4">
          <AlertCircle className="h-6 w-6" />
          <h2 className="text-lg font-semibold">API密钥未配置</h2>
        </div>

        <div className="space-y-3 text-sm text-[var(--text-primary)]">
          <p>转录功能需要 GROQ_API_KEY 环境变量才能正常工作。</p>

          <div className="bg-[var(--state-info-surface)] border border-[var(--state-info-border)] rounded p-3">
            <p className="font-medium mb-2">解决方法：</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>
                在项目根目录创建{' '}
                <code className="bg-[var(--border-color)] px-1 rounded">.env.local</code> 文件
              </li>
              <li>添加以下内容到文件中：</li>
            </ol>
            <div className="mt-2 p-2 bg-[var(--border-color)] rounded text-xs font-mono">
              GROQ_API_KEY=your_groq_api_key_here
            </div>
            <p className="mt-2 text-xs">
              获取API密钥：访问{' '}
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Groq Console
              </a>
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={handleRefresh}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--button-color)] text-[var(--button-text)] rounded hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="h-4 w-4" />
            刷新页面
          </button>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex-1 px-4 py-2 bg-[var(--border-color)] text-[var(--text-primary)] rounded hover:opacity-90 transition-opacity"
            >
              重试
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
