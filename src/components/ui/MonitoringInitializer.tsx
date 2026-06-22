'use client'

import { useEffect } from 'react'
import { setErrorMonitor } from '~/lib/utils/error-handler'
import { getMonitoringService, initializeMonitoring } from '~/lib/utils/monitoring-service'
import { initWebVitals } from '~/lib/utils/web-vitals'

export function MonitoringInitializer() {
  useEffect(() => {
    // 初始化监控（采样率50%，避免过多数据）
    initializeMonitoring({
      enabled: true,
      sampleRate: 0.5,
      trackPerformance: true,
      trackUserActions: true,
      trackResources: false,
      enableConsoleCapture: false,
      maxBatchSize: 25,
      flushInterval: 30000,
    })

    // initializeMonitoring 创建新单例后，再获取并注册到 error handler
    const monitoringService = getMonitoringService()
    setErrorMonitor(monitoringService)

    // 初始化 Web Vitals 监控
    initWebVitals()

    monitoringService.logCustomEvent('page', 'load', {
      url: window.location.href,
      referrer: document.referrer,
      timestamp: Date.now(),
    })

    return () => {
      monitoringService.destroy()
    }
  }, [])

  return null
}
