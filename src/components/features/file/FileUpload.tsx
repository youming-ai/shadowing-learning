"use client";

import { useCallback, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/layout/contexts/I18nContext";
import { checkFileSignature, isValidAudioFile, MAX_FILES } from "@/lib/utils/file-validation";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
  uploadedCount?: number;
  totalCount?: number;
  className?: string;
  currentFileCount?: number;
  maxFiles?: number;
}

export default function FileUpload({
  onFilesSelected,
  isUploading = false,
  uploadedCount = 0,
  totalCount = 0,
  className = "",
  currentFileCount = 0,
  maxFiles = MAX_FILES,
}: FileUploadProps) {
  const { t } = useI18n();
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadDescriptionId = useId();

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files) return;

      const fileArray = Array.from(files);
      setIsDragActive(false);

      // 第一道：扩展名 / MIME 过滤
      const candidates = fileArray.filter(isValidAudioFile);

      if (candidates.length === 0) {
        toast.error("没有有效的音频文件");
        return;
      }

      // 第二道：magic-number 校验（防止伪装文件）
      const signatureChecks = await Promise.all(
        candidates.map(async (file) => ({
          file,
          check: await checkFileSignature(file),
        })),
      );

      const audioFiles = signatureChecks
        .filter(({ check }) => check.isValid)
        .map(({ file }) => file);

      const malicious = signatureChecks.filter(
        ({ check }) => check.reason === "MALICIOUS_SIGNATURE",
      );
      if (malicious.length > 0) {
        toast.error(`${malicious.length} 个文件被识别为可疑类型，已拒绝上传`);
      }

      const skipped = candidates.length - audioFiles.length - malicious.length;
      if (skipped > 0) {
        toast.warning(`${skipped} 个文件无法识别为有效音频，已忽略`);
      }

      const totalIgnored = fileArray.length - audioFiles.length;
      if (audioFiles.length === 0) {
        if (totalIgnored > 0 && malicious.length === 0 && skipped === 0) {
          toast.error("没有有效的音频文件");
        }
        return;
      }

      // CheckFile数量限制
      const remainingSlots = maxFiles - currentFileCount;
      if (remainingSlots <= 0) {
        toast.error(`已达到最大文件数量限制 (${maxFiles}个文件)`);
        return;
      }

      // If选择File超过剩余槽位，只取前面File
      const filesToAdd = audioFiles.slice(0, remainingSlots);
      if (filesToAdd.length < audioFiles.length) {
        toast.warning(`只能添加 ${remainingSlots} 个文件，已达到最大限制`);
      }

      if (filesToAdd.length > 0) {
        onFilesSelected(filesToAdd);
      }
    },
    [onFilesSelected, currentFileCount, maxFiles],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDragActive) {
        setIsDragActive(true);
      }
    },
    [isDragActive],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleFileInputClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      // 在清空 input 之前先快照成数组，避免 FileList 被释放后 magic-number 校验拿不到内容
      const snapshot = event.target.files ? Array.from(event.target.files) : [];
      // 清空input以允许重复选择相同File
      event.target.value = "";
      handleFiles(snapshot);
    },
    [handleFiles],
  );

  const isDisabled = isUploading || currentFileCount >= maxFiles;
  const remainingSlots = maxFiles - currentFileCount;

  return (
    <div className={className}>
      <div
        className={`upload-area ${isDisabled ? "disabled" : ""}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleFileInputClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " " || event.key === "Space") {
            event.preventDefault();
            if (!isDisabled) {
              handleFileInputClick();
            }
          }
        }}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-label="文件上传区域"
        aria-describedby={uploadDescriptionId}
        aria-disabled={isDisabled}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*"
          onChange={handleFileInputChange}
          className="hidden"
          aria-label="选择音频文件"
        />

        {isUploading ? (
          // uploadin加载state
          <div className="flex flex-col items-center gap-4">
            <div className="loading-spinner">
              <span
                className="material-symbols-outlined text-6xl text-[var(--button-color)] animate-spin"
                aria-hidden="true"
              >
                progress_activity
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {t("file.upload.uploading")}
              </p>
              {totalCount > 0 && (
                <p className="text-md text-[var(--text-secondary)]">
                  {uploadedCount} / {totalCount}
                </p>
              )}
            </div>
          </div>
        ) : (
          // 默认upload区域
          <>
            <span
              className="material-symbols-outlined text-6xl text-[var(--state-success-text)]"
              aria-hidden="true"
            >
              cloud_upload
            </span>

            <div className="flex flex-col items-center gap-2">
              <p className="text-xl font-bold text-[var(--text-primary)]" id={uploadDescriptionId}>
                {currentFileCount >= maxFiles
                  ? t("file.upload.maxFilesReached")
                  : t("file.upload.dragDrop")}
              </p>
              <p className="text-md text-[var(--text-secondary)]">{t("file.upload.orClick")}</p>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={(e) => {
                e.stopPropagation(); // 防止事件冒泡Tosection
                handleFileInputClick();
              }}
              aria-describedby={uploadDescriptionId}
              disabled={isDisabled}
            >
              <span>
                {currentFileCount >= maxFiles
                  ? t("file.upload.maxFilesReached")
                  : t("file.upload.selectFiles")}
              </span>
            </button>

            <div className="flex flex-col items-center gap-1 mt-4">
              <p className="text-sm text-[var(--text-muted)]">
                {currentFileCount >= maxFiles
                  ? `最多支持 ${maxFiles} 个文件`
                  : `支持 MP3、WAV、M4A、OGG、FLAC 格式`}
              </p>
              {currentFileCount < maxFiles && remainingSlots > 0 && (
                <p className="text-xs text-[var(--text-muted)]">还可添加 {remainingSlots} 个文件</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
