import { toast } from "sonner";
import {
  type AppError,
  type ErrorCode,
  ErrorCodes,
  type ErrorContext,
  type ErrorMonitor,
  getDefaultErrorMessage,
  LogLevel,
} from "@/types/api/errors";
import { type RetryOptions, withRetry } from "./retry-utils";

// Re-export LogLevel for backward compatibility
export { LogLevel };

// 错误监控 API 扩展
export interface ExtendedErrorMonitor {
  logError(error: AppError, context?: ErrorContext): void;
  logInfo(message: string, context?: ErrorContext): void;
  logWarning(message: string, context?: ErrorContext): void;
  flush?(): Promise<void>;
}

// 本地存储错误日志
export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  code?: string;
  context?: ErrorContext;
  stack?: string;
}

// 全局错误监控实例
let globalErrorMonitor: ErrorMonitor | null = null;

// 设置全局错误监控
export function setErrorMonitor(monitor: ErrorMonitor): void {
  globalErrorMonitor = monitor;
}

// 获取全局错误监控
export function getErrorMonitor(): ErrorMonitor | null {
  return globalErrorMonitor;
}

// 创建错误
export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  statusCode: number = 500,
  _context?: ErrorContext,
): AppError {
  const errorCode = ErrorCodes[code];

  // 安全获取 stack 属性
  let stack: string | undefined;
  try {
    const testError = new Error();
    stack = testError.stack;
  } catch {
    stack = undefined;
  }

  return {
    code: errorCode,
    message,
    details,
    statusCode,
    timestamp: Date.now(),
    stack,
    context: {
      timestamp: Date.now(),
    },
  };
}

// 记录错误到控制台和监控服务
export function logError(error: AppError, context?: string): void {
  const errorContext: ErrorContext = {
    timestamp: Date.now(),
    component: context,
    additional: {
      ...(error.details || {}),
      stack: getErrorStack(error),
    },
  };

  // 控制台输出
  const _logMessage = context
    ? `[${context}] ${error.code}: ${error.message}`
    : `${error.code}: ${error.message}`;

  // 发送到错误监控服务
  if (globalErrorMonitor) {
    globalErrorMonitor.logError(error, errorContext);
  }

  // 本地存储错误日志
  logErrorLocally(error, errorContext);
}

// 检查是否为应用错误
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "statusCode" in error
  );
}

// 处理错误
export function handleError(error: unknown, context?: string): AppError {
  if (isAppError(error)) {
    logError(error, context);
    return error;
  }

  if (typeof error === "string") {
    const appError = createError("internalServerError", error, undefined, 500);
    logError(appError, context);
    return appError;
  }

  if (error instanceof Error) {
    const appError = createError("internalServerError", error.message, { stack: error.stack }, 500);
    logError(appError, context);
    return appError;
  }

  const appError = createError(
    "internalServerError",
    "未知错误",
    typeof error === "object" && error !== null ? { error } : undefined,
    500,
  );
  logError(appError, context);
  return appError;
}

// 静默处理错误（不记录日志）
export function handleSilently(error: unknown, _context?: string): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return createError("internalServerError", error.message, { stack: error.stack }, 500);
  }

  return createError(
    "internalServerError",
    "未知错误",
    typeof error === "object" && error !== null ? { error } : undefined,
    500,
  );
}

// 显示用户友好错误消息
export function showErrorToast(error: AppError | unknown): void {
  const appError = isAppError(error) ? error : handleError(error);

  const userMessage = getDefaultErrorMessage(appError.code) || appError.message;
  toast.error(userMessage);
}

// 显示成功消息
export function showSuccessToast(message: string): void {
  toast.success(message);
}

// 验证错误
export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return createError("apiValidationError", message, details, 400);
}

// 未找到错误
export function notFoundError(message: string, details?: Record<string, unknown>): AppError {
  return createError("fileNotFound", message, details, 404);
}

// 内部服务器错误
export function internalError(message: string, details?: Record<string, unknown>): AppError {
  return createError("internalServerError", message, details, 500);
}

// 网络错误
export function networkError(
  message: string = "Network error occurred",
  details?: Record<string, unknown>,
): AppError {
  return createError("networkError", message, details, 503);
}

// databaseError
export function databaseError(message: string, details?: Record<string, unknown>): AppError {
  return createError("dbQueryFailed", message, details, 500);
}

// 文件上传错误
export function fileUploadError(message: string, details?: Record<string, unknown>): AppError {
  return createError("fileUploadFailed", message, details, 400);
}

// 音频处理错误
export function audioProcessingError(message: string, details?: Record<string, unknown>): AppError {
  return createError("audioProcessingError", message, details, 500);
}

// 转录错误
export function transcriptionError(message: string, details?: Record<string, unknown>): AppError {
  return createError("transcriptionFailed", message, details, 500);
}

// API 错误
export function apiError(
  message: string,
  statusCode: number = 500,
  details?: Record<string, unknown>,
): AppError {
  return createError("apiValidationError", message, details, statusCode);
}

// 本地错误日志存储
function logErrorLocally(error: AppError, context: ErrorContext): void {
  try {
    const logs = getLocalErrorLogs();
    const entry: ErrorLogEntry = {
      id: generateErrorId(),
      timestamp: context.timestamp || Date.now(),
      level: LogLevel.ERROR,
      message: error.message,
      code: error.code,
      context,
      stack: getErrorStack(error),
    };

    logs.push(entry);

    // 只保留最近 100 条错误日志
    if (logs.length > 100) {
      logs.splice(0, logs.length - 100);
    }

    localStorage.setItem("app_error_logs", JSON.stringify(logs));
  } catch (_storageError) {}
}

// 获取本地错误日志
export function getLocalErrorLogs(): ErrorLogEntry[] {
  try {
    const logs = localStorage.getItem("app_error_logs");
    return logs ? JSON.parse(logs) : [];
  } catch {
    return [];
  }
}

// 清除本地错误日志
export function clearLocalErrorLogs(): void {
  localStorage.removeItem("app_error_logs");
}

// 生成错误 ID
function generateErrorId(): string {
  return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getErrorStack(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "stack" in error) {
    const stack = (error as { stack?: unknown }).stack;
    if (typeof stack === "string") {
      return stack;
    }
  }
  return undefined;
}

// 带重试的错误处理
export async function handleWithRetry<T>(
  fn: () => Promise<T>,
  retryOptions?: RetryOptions,
  context?: string,
): Promise<T> {
  const result = await withRetry(fn, {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    onRetry: (error, attempt) => {
      const message = `操作失败，正在重试 (${attempt}/3): ${error.message}`;
      toast.warning(message);
    },
    ...retryOptions,
  });

  if (!result.success || result.data === undefined) {
    const appError = handleError(result.error, context);
    showErrorToast(appError);
    throw appError;
  }

  return result.data;
}

// Process并显示Error（UI友好ErrorProcess）
export function handleAndShowError(
  error: unknown,
  context?: string,
  customMessage?: string,
): AppError {
  const appError = handleError(error, context);

  if (customMessage) {
    showErrorToast({ ...appError, message: customMessage });
  } else {
    showErrorToast(appError);
  }

  return appError;
}

// Checkis否asAPI密钥相关Error
export function isApiKeyError(error: unknown): boolean {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes("groq_api_key") ||
      errorMessage.includes("环境变量未设置") ||
      errorMessage.includes("api key") ||
      errorMessage.includes("authentication")
    );
  }
  return false;
}

// Get用户友好Error消息
export function getFriendlyErrorMessage(error: unknown): string {
  if (isApiKeyError(error)) {
    return "请配置 GROQ_API_KEY 环境变量以使用转录功能";
  }

  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
      return "网络连接失败，请检查网络连接后重试";
    }

    if (errorMessage.includes("timeout")) {
      return "请求超时，请稍后重试";
    }

    if (errorMessage.includes("rate limit")) {
      return "请求过于频繁，请稍后重试";
    }

    if (errorMessage.includes("file size") || errorMessage.includes("文件大小")) {
      return "文件太大，请上传较小的音频文件";
    }

    return error.message;
  }

  return "未知错误，请重试";
}

// a了向后兼容，keep函数别名
export const ErrorHandler = {
  createError,
  logError,
  handleError,
  handleSilently,
  showErrorToast,
  showSuccessToast,
  validationError,
  notFoundError,
  internalError,
  networkError,
  databaseError,
  fileUploadError,
  audioProcessingError,
  transcriptionError,
  apiError,
  handleAndShowError,
  isAppError,
  handleWithRetry,
  setErrorMonitor,
  getErrorMonitor,
};

// 重新导出class型、API和枚举
export type { AppError, ErrorContext, LogLevel as ImportedLogLevel, RetryOptions };
