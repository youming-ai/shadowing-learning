/** * 用户友好Error提示component * 提供丰富Error展示、operations反馈和用户引导*/

"use client";

import { AlertTriangle, CheckCircle, Info, RefreshCw, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import type { AppError, ErrorStats } from "~/types/api/errors";

// Error提示class型
export type ToastType = "success" | "error" | "warning" | "info";

// Error提示配置
export interface ToastConfig {
  id?: string;
  type: ToastType;
  title: string;
  message?: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  dismissible?: boolean;
  persistent?: boolean;
  progress?: boolean;
  showDetails?: boolean;
  details?: React.ReactNode;
}

// Error提示component
export function ErrorToast({ config, onDismiss }: { config: ToastConfig; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (config.duration && !config.persistent) {
      const interval = 100; // Update间隔
      const steps = config.duration / interval;
      let currentStep = 0;

      const timer = setInterval(() => {
        currentStep++;
        setProgress(100 - (currentStep / steps) * 100);

        if (currentStep >= steps) {
          clearInterval(timer);
          setIsVisible(false);
          setTimeout(() => onDismiss(), 300); // 等待动画完成
        }
      }, interval);

      return () => clearInterval(timer);
    }
  }, [config.duration, config.persistent, onDismiss]);

  const getIcon = () => {
    switch (config.type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-success-500" />;
      case "error":
        return <AlertTriangle className="h-5 w-5 text-error-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-warning-500" />;
      case "info":
        return <Info className="h-5 w-5 text-info-500" />;
      default:
        return <Info className="h-5 w-5 text-muted" />;
    }
  };

  const getBackgroundColor = () => {
    switch (config.type) {
      case "success":
        return "bg-success-50 border-success-200";
      case "error":
        return "bg-error-50 border-error-200";
      case "warning":
        return "bg-warning-50 border-warning-200";
      case "info":
        return "bg-info-50 border-info-200";
      default:
        return "bg-surface border-border";
    }
  };

  const getBorderColor = () => {
    switch (config.type) {
      case "success":
        return "border-l-success-500";
      case "error":
        return "border-l-error-500";
      case "warning":
        return "border-l-warning-500";
      case "info":
        return "border-l-info-500";
      default:
        return "border-l-muted";
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Card
      className={`mb-2 border-l-4 ${getBackgroundColor()} ${getBorderColor()} shadow-lg transition-all duration-300`}
    >
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          {/*图标*/}
          <div className="mt-0.5 flex-shrink-0">{getIcon()}</div>

          {/*内容*/}
          <div className="min-w-0 flex-1">
            {/*标题和关闭按钮*/}
            <div className="mb-1 flex items-start justify-between">
              <h4 className="truncate pr-2 font-medium text-sm text-primary">{config.title}</h4>
              {config.dismissible && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="h-6 w-6 p-0 text-muted hover:text-primary"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/*消息*/}
            {config.message && <p className="mb-2 text-sm text-secondary">{config.message}</p>}

            {/*描述*/}
            {config.description && (
              <p className="mb-3 text-xs text-tertiary">{config.description}</p>
            )}

            {/*详细信息*/}
            {config.showDetails && config.details && (
              <div className="mb-3 rounded border border-secondary bg-surface p-2">
                <div className="text-xs text-secondary">{config.details}</div>
              </div>
            )}

            {/*operations按钮*/}
            {config.action && (
              <div className="mb-2 flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={config.action.onClick}
                  className="text-xs"
                >
                  {config.action.icon && <span className="mr-1 h-3 w-3">{config.action.icon}</span>}
                  {config.action.label}
                </Button>
              </div>
            )}

            {/*进度条*/}
            {config.progress && config.duration && !config.persistent && (
              <div className="mt-2">
                <Progress value={progress} className="h-1" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 网络stateError提示
export function NetworkErrorToast({
  onRetry,
  onDismiss,
}: {
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <ErrorToast
      config={{
        type: "error",
        title: "网络连接失败",
        message: "请检查您的网络连接后重试",
        duration: 8000,
        persistent: true,
        action: {
          label: "重试",
          onClick: onRetry,
          icon: <RefreshCw className="h-3 w-3" />,
        },
      }}
      onDismiss={onDismiss}
    />
  );
}

// APIError提示
export function ApiErrorToast({
  error,
  onRetry,
  onDismiss,
}: {
  error: AppError;
  onRetry?: () => void;
  onDismiss: () => void;
}) {
  const getApiErrorMessage = (
    error: AppError,
  ): { title: string; message: string; description?: string } => {
    switch (error.code) {
      case "NETWORK_ERROR":
        return {
          title: "网络错误",
          message: "网络连接失败，请检查网络设置",
        };
      case "API_RATE_LIMIT":
        return {
          title: "请求过于频繁",
          message: "请求次数超过限制，请稍后重试",
          description: "您可以等待几分钟后再次尝试",
        };
      case "API_TIMEOUT":
        return {
          title: "请求超时",
          message: "服务器响应时间过长，请重试",
        };
      case "API_AUTH_ERROR":
        return {
          title: "认证失败",
          message: "请重新登录或检查您的凭证",
        };
      default:
        return {
          title: "请求失败",
          message: error.message || "服务器错误，请稍后重试",
        };
    }
  };

  const errorInfo = getApiErrorMessage(error);

  return (
    <ErrorToast
      config={{
        type: "error",
        title: errorInfo.title,
        message: errorInfo.message,
        description: errorInfo.description,
        duration: 10000,
        persistent: false,
        action: onRetry
          ? {
              label: "重试",
              onClick: onRetry,
              icon: <RefreshCw className="h-3 w-3" />,
            }
          : undefined,
        showDetails: true,
        details: (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-tertiary">错误代码:</span>
              <Badge variant="outline" className="text-xs">
                {error.code}
              </Badge>
            </div>
            {error.statusCode && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-tertiary">状态码:</span>
                <Badge variant="outline" className="text-xs">
                  {error.statusCode}
                </Badge>
              </div>
            )}
          </div>
        ),
      }}
      onDismiss={onDismiss}
    />
  );
}

// FileuploadError提示
export function FileUploadErrorToast({
  error,
  onRetry,
  onDismiss,
}: {
  error: AppError;
  onRetry?: () => void;
  onDismiss: () => void;
}) {
  const getFileUploadErrorMessage = (error: AppError): { title: string; message: string } => {
    switch (error.code) {
      case "FILE_UPLOAD_FAILED":
        return {
          title: "文件上传失败",
          message: "文件上传过程中发生错误，请重试",
        };
      case "FILE_NOT_FOUND":
        return {
          title: "文件不存在",
          message: "指定的文件无法找到，请重新选择",
        };
      case "FILE_TOO_LARGE":
        return {
          title: "文件过大",
          message: "文件大小超过限制，请选择较小的文件",
        };
      case "INVALID_FILE_TYPE":
        return {
          title: "文件格式不支持",
          message: "请选择支持的音频文件格式",
        };
      default:
        return {
          title: "文件处理失败",
          message: error.message || "文件处理时发生错误",
        };
    }
  };

  const errorInfo = getFileUploadErrorMessage(error);

  return (
    <ErrorToast
      config={{
        type: "error",
        title: errorInfo.title,
        message: errorInfo.message,
        duration: 8000,
        persistent: false,
        action: onRetry
          ? {
              label: "重新上传",
              onClick: onRetry,
              icon: <RefreshCw className="h-3 w-3" />,
            }
          : undefined,
      }}
      onDismiss={onDismiss}
    />
  );
}

// Transcription进度提示
export function TranscriptionProgressToast({
  progress,
  fileName,
  onCancel,
  onDismiss,
}: {
  progress: number;
  fileName: string;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  return (
    <ErrorToast
      config={{
        type: "info",
        title: "正在转录音频",
        message: `正在处理: ${fileName}`,
        description: `进度: ${Math.round(progress)}%`,
        duration: 0, // 不自动消失
        persistent: true,
        action: {
          label: "取消",
          onClick: onCancel,
          icon: <X className="h-3 w-3" />,
        },
        progress: true,
      }}
      onDismiss={onDismiss}
    />
  );
}

// Success提示
export function SuccessToast({
  title,
  message,
  action,
  onDismiss,
}: {
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
  onDismiss: () => void;
}) {
  return (
    <ErrorToast
      config={{
        type: "success",
        title,
        message,
        duration: 5000,
        persistent: false,
        action,
      }}
      onDismiss={onDismiss}
    />
  );
}

// Error统计提示
export function ErrorStatsToast({
  stats,
  onDismiss,
  onClear,
}: {
  stats: ErrorStats;
  onDismiss: () => void;
  onClear: () => void;
}) {
  return (
    <ErrorToast
      config={{
        type: "warning",
        title: "错误统计",
        message: `最近1小时内发生了 ${stats.errorFrequency} 个错误`,
        showDetails: true,
        details: (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-tertiary">总错误数:</div>
              <div className="text-right text-primary">{stats.totalErrors}</div>
              <div className="text-tertiary">错误频率:</div>
              <div className="text-right text-primary">{stats.errorFrequency}/小时</div>
            </div>
            {stats.lastErrorTime && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-tertiary">最后错误时间:</span>
                <span>{new Date(stats.lastErrorTime).toLocaleTimeString()}</span>
              </div>
            )}
            {Object.keys(stats.errorsByCode).length > 0 && (
              <div>
                <div className="mb-1 text-xs text-tertiary">常见错误:</div>
                <div className="space-y-1">
                  {Object.entries(stats.errorsByCode)
                    .sort(([, a], [, b]) => Number(b) - Number(a))
                    .slice(0, 3)
                    .map(([code, count]) => (
                      <div key={code} className="flex items-center justify-between text-xs">
                        <Badge variant="outline" className="text-xs">
                          {code}
                        </Badge>
                        <span>{String(count)} 次</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ),
        action: {
          label: "清除日志",
          onClick: onClear,
          icon: <X className="h-3 w-3" />,
        },
      }}
      onDismiss={onDismiss}
    />
  );
}

// Toast容器component
export function ToastContainer({ children }: { children: React.ReactNode }) {
  return <div className="fixed top-4 right-4 z-50 w-full max-w-sm space-y-2">{children}</div>;
}

// Toast Hook
export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; config: ToastConfig }>>([]);

  const addToast = (config: ToastConfig) => {
    const id = config.id || `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, config }]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const showSuccess = (title: string, message?: string) => {
    return addToast({ type: "success", title, message, duration: 5000 });
  };

  const showError = (title: string, message?: string) => {
    return addToast({ type: "error", title, message, duration: 8000 });
  };

  const showWarning = (title: string, message?: string) => {
    return addToast({ type: "warning", title, message, duration: 6000 });
  };

  const showInfo = (title: string, message?: string) => {
    return addToast({ type: "info", title, message, duration: 5000 });
  };

  const showNetworkError = (onRetry?: () => void) => {
    return addToast({
      type: "error",
      title: "网络连接失败",
      message: "请检查您的网络连接后重试",
      duration: 8000,
      persistent: true,
      action: onRetry
        ? {
            label: "重试",
            onClick: onRetry,
            icon: <RefreshCw className="h-3 w-3" />,
          }
        : undefined,
    });
  };

  const showApiError = (error: AppError, onRetry?: () => void) => {
    return addToast({
      type: "error",
      title: "API请求失败",
      message: error.message,
      duration: 10000,
      action: onRetry
        ? {
            label: "重试",
            onClick: onRetry,
            icon: <RefreshCw className="h-3 w-3" />,
          }
        : undefined,
      showDetails: true,
      details: (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-tertiary">错误代码:</span>
            <Badge variant="outline" className="text-xs">
              {error.code}
            </Badge>
          </div>
          {error.statusCode && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-tertiary">状态码:</span>
              <Badge variant="outline" className="text-xs">
                {error.statusCode}
              </Badge>
            </div>
          )}
        </div>
      ),
    });
  };

  const clearAll = () => {
    setToasts([]);
  };

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showNetworkError,
    showApiError,
    clearAll,
  };
}
