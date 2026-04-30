/** * 性能指标收集API * Used for接收和存储client性能数据*/

import { type NextRequest, NextResponse } from "next/server";
import { apiSuccess } from "@/lib/utils/api-response";
import { performanceLogger } from "@/lib/utils/logger";

export const runtime = "nodejs";

// Memory存储性能数据（生产环境应使用database或外部服务）
const performanceStore = new Map<string, StoredPerformanceData[]>();
const MAX_DAYS_TO_KEEP = 7; // keep最近 7 天数据

// 清理过期数据
function cleanupOldData(): void {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_DAYS_TO_KEEP);
  const cutoffKey = cutoffDate.toISOString().split("T")[0];

  for (const key of performanceStore.keys()) {
    if (key < cutoffKey) {
      performanceStore.delete(key);
    }
  }
}

type MetricValue = number | undefined;

interface PerformanceMetrics {
  [metricName: string]: MetricValue;
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  transcriptionTime?: number;
  uploadTime?: number;
  apiResponseTime?: number;
  memoryUsage?: number;
  errorCount?: number;
  crashCount?: number;
}

// 性能数据API
interface PerformanceData {
  metrics: PerformanceMetrics;
  url: string;
  timestamp: number;
  userAgent: string;
  sessionId?: string;
}

interface StoredPerformanceData extends PerformanceData {
  receivedAt: number;
}

interface PercentileStats {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  avg: number;
  min: number;
  max: number;
}

interface PerformanceStats {
  coreWebVitals: {
    fcp: PercentileStats | null;
    lcp: PercentileStats | null;
    fid: PercentileStats | null;
    cls: PercentileStats | null;
  };
  customMetrics: {
    transcriptionTime: PercentileStats | null;
    uploadTime: PercentileStats | null;
    apiResponseTime: PercentileStats | null;
  };
  errors: {
    totalErrors: number;
    totalCrashes: number;
  };
  sessions: {
    uniqueSessions: number;
    averageSessionLength: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const data: PerformanceData = await request.json();

    // Validate数据格式
    if (!data.metrics || !data.timestamp) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid performance data format",
        },
        { status: 400 },
      );
    }

    // 生成会话ID（基于时间戳和用户代理简单哈希）
    const sessionId = generateSessionId(data.userAgent);
    data.sessionId = sessionId;

    // 存储性能数据
    const dateKey = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    if (!performanceStore.has(dateKey)) {
      performanceStore.set(dateKey, []);
      // 新一天开始时清理过期数据
      cleanupOldData();
    }

    const dailyData = performanceStore.get(dateKey);
    if (dailyData) {
      dailyData.push({
        ...data,
        receivedAt: Date.now(),
      });

      // 保持最近1000条record
      if (dailyData.length > 1000) {
        dailyData.splice(0, dailyData.length - 1000);
      }
    }

    // 检测性能问题
    const issues = detectPerformanceIssues(data.metrics);

    // 异步Process数据（不阻塞response）
    processPerformanceData(data, issues).catch((error) => {
      performanceLogger.error("Failed to process performance data:", error);
    });

    return apiSuccess({
      received: true,
      sessionId,
      issues: issues.length > 0 ? issues : undefined,
    });
  } catch (error) {
    performanceLogger.error("Performance API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process performance data",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminToken = process.env.PERFORMANCE_ADMIN_TOKEN;
    const authHeader = request.headers.get("authorization");

    if (process.env.NODE_ENV === "production") {
      if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
        return NextResponse.json(
          {
            success: false,
            error: "Not found",
          },
          { status: 404 },
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const sessionId = searchParams.get("session");

    let data: StoredPerformanceData[] = [];

    if (sessionId) {
      // Get特定会话数据
      for (const [, dailyData] of performanceStore.entries()) {
        const sessionData = dailyData.filter((item) => item.sessionId === sessionId);
        data.push(...sessionData);
      }
    } else {
      // Get特定日期数据
      data = performanceStore.get(date) ?? [];
    }

    // 计算统计数据
    const stats = calculatePerformanceStats(data);

    return apiSuccess({
      date,
      sessionId: sessionId || undefined,
      totalRecords: data.length,
      stats,
      recentData: data.slice(-10), // 最近10条record
    });
  } catch (error) {
    performanceLogger.error("Performance GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve performance data",
      },
      { status: 500 },
    );
  }
}

// 生成会话ID
function generateSessionId(userAgent: string): string {
  const timestamp = Date.now().toString();
  const hash = simpleHash(userAgent + timestamp);
  return `session_${hash}`;
}

// 简单哈希函数
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换as32位整数
  }
  return Math.abs(hash).toString(36);
}

// 检测性能问题
function detectPerformanceIssues(metrics: PerformanceMetrics): string[] {
  const issues: string[] = [];

  // Core Web Vitals 阈值
  if (isValidMetricValue(metrics.fcp) && metrics.fcp > 2500) {
    issues.push(`FCP 过慢: ${Math.round(metrics.fcp)}ms`);
  }

  if (isValidMetricValue(metrics.lcp) && metrics.lcp > 4000) {
    issues.push(`LCP 过慢: ${Math.round(metrics.lcp)}ms`);
  }

  if (isValidMetricValue(metrics.fid) && metrics.fid > 300) {
    issues.push(`FID 过慢: ${Math.round(metrics.fid)}ms`);
  }

  if (isValidMetricValue(metrics.cls) && metrics.cls > 0.25) {
    issues.push(`CLS 过高: ${metrics.cls.toFixed(3)}`);
  }

  // 自定义指标阈值
  if (isValidMetricValue(metrics.transcriptionTime) && metrics.transcriptionTime > 60000) {
    issues.push(`转录时间过长: ${Math.round(metrics.transcriptionTime / 1000)}秒`);
  }

  if (isValidMetricValue(metrics.uploadTime) && metrics.uploadTime > 30000) {
    issues.push(`上传时间过长: ${Math.round(metrics.uploadTime / 1000)}秒`);
  }

  if (isValidMetricValue(metrics.apiResponseTime) && metrics.apiResponseTime > 5000) {
    issues.push(`API响应时间过长: ${Math.round(metrics.apiResponseTime)}ms`);
  }

  if (isValidMetricValue(metrics.memoryUsage) && metrics.memoryUsage > 100 * 1024 * 1024) {
    issues.push(`内存使用过高: ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`);
  }

  if (isValidMetricValue(metrics.errorCount) && metrics.errorCount > 5) {
    issues.push(`错误次数过多: ${metrics.errorCount}次`);
  }

  return issues;
}

// 计算性能统计数据
function calculatePerformanceStats(data: StoredPerformanceData[]): PerformanceStats | null {
  if (data.length === 0) {
    return null;
  }

  // Core Web Vitals 统计
  const fcpValues = collectMetricValues(data, (metrics) => metrics.fcp);
  const lcpValues = collectMetricValues(data, (metrics) => metrics.lcp);
  const fidValues = collectMetricValues(data, (metrics) => metrics.fid);
  const clsValues = collectMetricValues(data, (metrics) => metrics.cls);

  // 自定义指标统计
  const transcriptionTimes = collectMetricValues(data, (metrics) => metrics.transcriptionTime);
  const uploadTimes = collectMetricValues(data, (metrics) => metrics.uploadTime);
  const apiResponseTimes = collectMetricValues(data, (metrics) => metrics.apiResponseTime);

  const totalErrors = data.reduce((sum, entry) => sum + (entry.metrics.errorCount ?? 0), 0);
  const totalCrashes = data.reduce((sum, entry) => sum + (entry.metrics.crashCount ?? 0), 0);
  const uniqueSessions = new Set(
    data
      .map((entry) => entry.sessionId)
      .filter(
        (sessionId): sessionId is string => typeof sessionId === "string" && sessionId.length > 0,
      ),
  ).size;

  return {
    coreWebVitals: {
      fcp: calculatePercentiles(fcpValues),
      lcp: calculatePercentiles(lcpValues),
      fid: calculatePercentiles(fidValues),
      cls: calculatePercentiles(clsValues),
    },
    customMetrics: {
      transcriptionTime: calculatePercentiles(transcriptionTimes),
      uploadTime: calculatePercentiles(uploadTimes),
      apiResponseTime: calculatePercentiles(apiResponseTimes),
    },
    errors: {
      totalErrors,
      totalCrashes,
    },
    sessions: {
      uniqueSessions,
      averageSessionLength: calculateAverageSessionLength(data),
    },
  };
}

// 计算百分位数
function calculatePercentiles(values: number[]): PercentileStats | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const len = sorted.length;

  // 使用 Math.min 防止index越界
  return {
    p50: sorted[Math.min(Math.floor(len * 0.5), len - 1)],
    p75: sorted[Math.min(Math.floor(len * 0.75), len - 1)],
    p90: sorted[Math.min(Math.floor(len * 0.9), len - 1)],
    p95: sorted[Math.min(Math.floor(len * 0.95), len - 1)],
    avg: sorted.reduce((sum, val) => sum + val, 0) / len,
    min: sorted[0],
    max: sorted[len - 1],
  };
}

// 计算平均会话长度
function calculateAverageSessionLength(data: StoredPerformanceData[]): number {
  const sessionLengths = new Map<string, number[]>();

  data.forEach((item) => {
    const sessionId = item.sessionId;
    if (!sessionId) {
      return;
    }

    if (!sessionLengths.has(sessionId)) {
      sessionLengths.set(sessionId, []);
    }
    sessionLengths.get(sessionId)?.push(item.timestamp);
  });

  let totalLength = 0;
  let sessionCount = 0;

  for (const timestamps of sessionLengths.values()) {
    if (timestamps.length > 1) {
      const sessionLength = Math.max(...timestamps) - Math.min(...timestamps);
      totalLength += sessionLength;
      sessionCount++;
    }
  }

  return sessionCount > 0 ? totalLength / sessionCount : 0;
}

function collectMetricValues(
  entries: StoredPerformanceData[],
  selector: (metrics: PerformanceMetrics) => number | undefined,
): number[] {
  return entries
    .map((entry) => selector(entry.metrics))
    .filter((value): value is number => isValidMetricValue(value));
}

function isValidMetricValue(value: MetricValue): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// 异步Process性能数据
async function processPerformanceData(data: PerformanceData, issues: string[]): Promise<void> {
  // 这里可以Add：
  // 1. 发送To外部监控服务（如 Sentry, DataDog 等）
  // 2. 存储Todatabase
  // 3. 生成告警
  // 4. 数据分析和报告

  // 示例：record严重性能问题
  if (issues.length > 0) {
    performanceLogger.warn("Performance issues detected:", {
      url: data.url,
      sessionId: data.sessionId,
      issues,
    });
  }

  // 示例：发送To外部服务（需要配置）
  // if (process.env.MONITORING_WEBHOOK) {
  // await fetch(process.env.MONITORING_WEBHOOK, {
  // method: 'POST',
  // headers: { 'Content-Type': 'application/json' },
  // body: JSON.stringify({ data, issues })
  // });
  // }
}
