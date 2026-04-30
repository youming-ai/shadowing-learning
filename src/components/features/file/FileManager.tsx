/** * SimplifiedFile管理器component * 使用统一Filestate管理系统*/

"use client";

import React, { useCallback, useState } from "react";

import { useTranscriptionLanguage } from "@/components/layout/contexts/TranscriptionLanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { useFiles } from "@/hooks";
import { useFileStatus, useFileStatusManager } from "@/hooks/useFileStatus";
import type { FileRow } from "@/types/db/database";
import FileCard from "./FileCard";
import FileUpload from "./FileUpload";

interface FileManagerProps {
  className?: string;
}

export default function FileManager({ className }: FileManagerProps) {
  // 基础state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Hooks
  const { files, addFiles, deleteFile } = useFiles();

  // 统一FileIDProcessas字符串
  const handleDeleteFile = useCallback(
    (fileId: number) => {
      deleteFile(fileId.toString());
    },
    [deleteFile],
  );

  // Process播放
  const handlePlayFile = useCallback((fileId: number) => {
    window.location.href = `/player/${fileId}`;
  }, []);

  // ProcessFileupload
  const handleFilesSelected = useCallback(
    async (selectedFiles: File[]) => {
      try {
        setIsUploading(true);
        setUploadedCount(0);
        setTotalCount(0);

        // CheckFile数量限制
        const currentFileCount = files?.length || 0;
        const maxFiles = 5;
        const remainingSlots = maxFiles - currentFileCount;

        if (remainingSlots <= 0) {
          const { toast } = await import("sonner");
          toast.error(`已达到最大文件数量限制 (${maxFiles}个文件)`);
          setIsUploading(false);
          return;
        }

        // If选择File超过剩余槽位，只取前面File
        const filesToAdd = selectedFiles.slice(0, remainingSlots);
        if (filesToAdd.length < selectedFiles.length) {
          const { toast } = await import("sonner");
          toast.warning(`只能添加 ${remainingSlots} 个文件，已达到最大限制`);
        }

        setTotalCount(filesToAdd.length);

        await addFiles(filesToAdd, {
          onProgress: (uploaded, total) => {
            setUploadedCount(uploaded);
            setTotalCount(total);
          },
        });

        const { toast } = await import("sonner");
        toast.success(`成功上传 ${filesToAdd.length} 个文件`);

        setIsUploading(false);
        setUploadedCount(0);
        setTotalCount(0);
      } catch (error) {
        const { toast } = await import("sonner");
        toast.error(`文件上传失败: ${error instanceof Error ? error.message : "未知错误"}`);
        setIsUploading(false);
        setUploadedCount(0);
        setTotalCount(0);
      }
    },
    [addFiles, files?.length],
  );

  // 排序File（按upload日期倒序）
  const sortedFiles = React.useMemo(() => {
    if (!files) return [];

    return files.sort((a, b) => {
      return (b.uploadedAt?.getTime() || 0) - (a.uploadedAt?.getTime() || 0);
    });
  }, [files]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/*Fileupload区域*/}
      <div className="mb-8">
        <FileUpload
          onFilesSelected={handleFilesSelected}
          isUploading={isUploading}
          uploadedCount={uploadedCount}
          totalCount={totalCount}
          currentFileCount={files?.length || 0}
          maxFiles={5}
        />
      </div>

      {/*File列table*/}
      <div>
        <h2 className="text-2xl font-bold mb-4 text-[var(--text-primary)]">文件列表</h2>
        <div className="space-y-4">
          {sortedFiles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-6xl mb-4">🎵</div>
                <h3 className="text-lg font-semibold mb-2">还没有上传任何文件</h3>
                <p className="text-muted-foreground text-center mb-4">
                  上传音频文件开始使用转录功能
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedFiles.map((file) => (
                <FileCardWrapper
                  key={file.id}
                  file={file}
                  onPlay={handlePlayFile}
                  onDelete={handleDeleteFile}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** * File卡片包装器，负责state管理*/
function FileCardWrapper({
  file,
  onPlay,
  onDelete,
}: {
  file: FileRow;
  onPlay: (fileId: number) => void;
  onDelete: (fileId: number) => void;
}) {
  // Hooks must be called before any early returns - Add空值Check
  const { data: statusData, isLoading } = useFileStatus(file.id || 0);
  const { startTranscription } = useFileStatusManager(file.id || 0);
  const { language } = useTranscriptionLanguage();

  // 优雅地Process可能缺失 file.id
  if (!file.id) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-gray-500">文件信息不完整</div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !statusData) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 合并File信息
  const fileWithStatus = {
    ...file,
    status: statusData.status,
  };

  // ProcessTranscription，使用动态LanguageSet
  const handleTranscribe = () => {
    startTranscription(language);
  };

  return (
    <FileCard
      file={fileWithStatus}
      onPlay={onPlay}
      onDelete={onDelete}
      onTranscribe={() => handleTranscribe()}
    />
  );
}
