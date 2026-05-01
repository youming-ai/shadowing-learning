/** * File卡片component * 显示File基本信息和Transcriptionstate，采用参考设计样式*/

"use client";

import type { FileDisplayStatus } from "@/lib/utils/file-status-manager";
import type { FileRow } from "@/types/db/database";

interface FileCardProps {
  file: FileRow & { status: FileDisplayStatus }; // status 必须由父component传入
  onPlay?: (fileId: number) => void;
  onDelete?: (fileId: number) => void;
  onTranscribe?: (fileId: number) => void;
}

export default function FileCard({ file, onPlay, onDelete, onTranscribe }: FileCardProps) {
  // 优雅地Process可能缺失 file.id
  if (!file.id) {
    return null;
  }

  const getStatusDisplay = () => {
    const status = file.status;

    switch (status) {
      case "transcribing":
        return {
          icon: "loading",
          color: "status-processing",
          label: "正在转录...",
          type: "音频",
        };
      case "completed":
        return {
          icon: "check_circle",
          color: "status-success",
          label: "转录成功",
          type: "字幕",
        };
      case "error":
        return {
          icon: "warning",
          color: "status-warning",
          label: "转录失败",
          type: "音频",
        };
      default:
        return {
          icon: "schedule",
          color: "status-ready",
          label: "未转录",
          type: "音频",
        };
    }
  };

  const status = getStatusDisplay();

  const getActions = () => {
    const fileStatus = file.status;

    switch (fileStatus) {
      case "completed":
        return (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={() => file.id && onPlay?.(file.id)}
              aria-label="播放文件"
            >
              <span className="material-symbols-outlined">play_arrow</span>
            </button>
            <button
              type="button"
              className="btn-delete"
              onClick={() => file.id && onDelete?.(file.id)}
              aria-label="删除文件"
            >
              <span className="material-symbols-outlined text-2xl">delete</span>
            </button>
          </>
        );
      case "transcribing":
        return (
          <>
            <div className="w-10 h-10 animate-spin rounded-full border-4 border-dashed border-blue-500"></div>
            <button
              type="button"
              className="btn-delete"
              onClick={() => file.id && onDelete?.(file.id)}
              aria-label="删除文件"
            >
              <span className="material-symbols-outlined text-2xl">delete</span>
            </button>
          </>
        );
      case "error":
        return (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={() => file.id && onTranscribe?.(file.id)}
              aria-label="重试转录"
            >
              <span>重试</span>
            </button>
            <button
              type="button"
              className="btn-delete"
              onClick={() => file.id && onDelete?.(file.id)}
              aria-label="删除文件"
            >
              <span className="material-symbols-outlined text-2xl">delete</span>
            </button>
          </>
        );
      default:
        return (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={() => file.id && onTranscribe?.(file.id)}
              aria-label="开始转录"
            >
              <span>转录</span>
            </button>
            <button
              type="button"
              className="btn-delete"
              onClick={() => file.id && onDelete?.(file.id)}
              aria-label="删除文件"
            >
              <span className="material-symbols-outlined text-2xl">delete</span>
            </button>
          </>
        );
    }
  };

  return (
    <div className="card-default p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className={`material-symbols-outlined text-4xl ${status.color}`}>{status.icon}</span>
        <div>
          <p className="text-file-name">{file.name}</p>
          <p className={`text-file-status ${status.color}`}>
            {status.type} · {status.label}
          </p>
        </div>
      </div>
      <div className="file-card-actions">{getActions()}</div>
    </div>
  );
}
