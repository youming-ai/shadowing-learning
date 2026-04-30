import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useTranscriptionStatus } from "@/hooks/api/useTranscription";
import { useFileStatusManager } from "@/hooks/useFileStatus";
import { DBUtils } from "@/lib/db/db";
import type { FileRow, Segment, TranscriptRow } from "@/types/db/database";

const audioUrlCache = new WeakMap<Blob, string>();

function createAudioUrl(blob: Blob): string {
  const cachedUrl = audioUrlCache.get(blob);
  if (cachedUrl) {
    return cachedUrl;
  }

  const url = URL.createObjectURL(blob);
  audioUrlCache.set(blob, url);
  return url;
}

function revokeAudioUrl(blob: Blob) {
  const url = audioUrlCache.get(blob);
  if (url) {
    URL.revokeObjectURL(url);
    audioUrlCache.delete(blob);
  }
}

export const playerKeys = {
  all: ["player"] as const,
  file: (fileId: number) => [...playerKeys.all, "file", fileId] as const,
};

function useFileQuery(fileId: number) {
  return useQuery({
    queryKey: playerKeys.file(fileId),
    queryFn: async () => {
      const file = await DBUtils.getFile(fileId);
      if (!file) {
        throw new Error("File not found");
      }

      let audioUrl: string | null = null;
      if (file.blob) {
        audioUrl = createAudioUrl(file.blob);
      }

      return { file, audioUrl };
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

interface UsePlayerDataQueryReturn {
  file: FileRow | null;
  segments: Segment[];
  transcript: TranscriptRow | null;
  audioUrl: string | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function usePlayerDataQuery(fileId: string): UsePlayerDataQueryReturn {
  const parsedFileId = parseInt(fileId, 10);

  const fileQuery = useFileQuery(parsedFileId);
  const file = fileQuery.data?.file || null;
  const audioUrl = fileQuery.data?.audioUrl || null;

  const transcriptionQuery = useTranscriptionStatus(parsedFileId);
  const transcript = transcriptionQuery.data?.transcript || null;
  const segments = transcriptionQuery.data?.segments || [];

  const { startTranscription } = useFileStatusManager(parsedFileId);
  const autoTranscribingRef = useRef(false);

  useEffect(() => {
    if (autoTranscribingRef.current) return;
    if (fileQuery.isLoading || fileQuery.error) return;
    if (transcriptionQuery.isLoading) return;

    const hasTranscript = transcript !== null;
    const isProcessing = transcript?.status === "processing";

    if (!hasTranscript && !isProcessing) {
      autoTranscribingRef.current = true;
      startTranscription().finally(() => {
        autoTranscribingRef.current = false;
      });
    }
  }, [
    transcript,
    fileQuery.isLoading,
    fileQuery.error,
    transcriptionQuery.isLoading,
    startTranscription,
  ]);

  useEffect(() => {
    const blob = file?.blob;
    return () => {
      if (blob) {
        revokeAudioUrl(blob);
      }
    };
  }, [file?.blob]);

  const loading = fileQuery.isLoading;
  const error = fileQuery.error?.message || null;

  const retry = useCallback(() => {
    fileQuery.refetch();
    transcriptionQuery.refetch();
  }, [fileQuery, transcriptionQuery]);

  return {
    file,
    segments,
    transcript,
    audioUrl,
    loading,
    error,
    retry,
  };
}
