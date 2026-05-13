"use client";

import { useEffect } from "react";
import { setErrorMonitor } from "~/lib/utils/error-handler";
import { getMonitoringService, initializeMonitoring } from "~/lib/utils/monitoring-service";
import { initWebVitals } from "~/lib/utils/web-vitals";

export function MonitoringInitializer() {
  useEffect(() => {
    // 初始化监控服务
    const monitoringService = getMonitoringService();

    // SetError监控
    setErrorMonitor(monitoringService);

    // 初始化监控（采样率50%，避免过多数据）
    initializeMonitoring({
      enabled: true,
      sampleRate: 0.5,
      trackPerformance: true,
      trackUserActions: true,
      trackResources: false, // 关闭资源跟踪以减少数据量
      enableConsoleCapture: false, // 开发环境可以开启
      maxBatchSize: 25,
      flushInterval: 30000,
    });

    // 初始化 Web Vitals 监控
    initWebVitals();

    // record页面访问
    monitoringService.logCustomEvent("page", "load", {
      url: window.location.href,
      referrer: document.referrer,
      timestamp: Date.now(),
    });

    // 页面卸载时清理
    return () => {
      monitoringService.destroy();
    };
  }, []);

  return null;
}
