/** * 统一日志工具 * 在开发环境输出日志，生产环境静默或发送To监控服务*/

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerOptions {
  enabled?: boolean
  prefix?: string
}

const isDev = process.env.NODE_ENV === 'development'

/** * 创建一个带前缀日志器*/
export function createLogger(prefix: string, options: LoggerOptions = {}) {
  const { enabled = isDev } = options

  const log = (level: LogLevel, ...args: unknown[]) => {
    if (!enabled) return

    const formattedPrefix = `[${prefix}]`
    switch (level) {
      case 'debug':
        // debug 只在开发环境显示
        if (isDev) console.debug(formattedPrefix, ...args)
        break
      case 'info':
        console.info(formattedPrefix, ...args)
        break
      case 'warn':
        console.warn(formattedPrefix, ...args)
        break
      case 'error':
        console.error(formattedPrefix, ...args)
        break
    }
  }

  return {
    debug: (...args: unknown[]) => log('debug', ...args),
    info: (...args: unknown[]) => log('info', ...args),
    warn: (...args: unknown[]) => log('warn', ...args),
    error: (...args: unknown[]) => log('error', ...args),
  }
}

// 预定义日志器实例
export const dbLogger = createLogger('DB')
export const apiLogger = createLogger('API')
export const transcriptionLogger = createLogger('Transcription')
export const performanceLogger = createLogger('Performance', { enabled: isDev })
export const themeLogger = createLogger('Theme', { enabled: isDev })

// 默认日志器
export const logger = createLogger('App')
