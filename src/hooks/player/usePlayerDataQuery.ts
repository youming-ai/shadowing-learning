import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { useTranscriptionStatus } from '~/hooks/api/useTranscription'
import { useFileStatusManager } from '~/hooks/useFileStatus'
import { DBUtils } from '~/lib/db/db'
import type { MediaRow, Segment, SubtitleRow } from '~/types/db/database'

const audioUrlCache = new WeakMap<Blob, string>()

function createAudioUrl(blob: Blob): string {
  const cachedUrl = audioUrlCache.get(blob)
  if (cachedUrl) {
    return cachedUrl
  }

  const url = URL.createObjectURL(blob)
  audioUrlCache.set(blob, url)
  return url
}

function revokeAudioUrl(blob: Blob) {
  const url = audioUrlCache.get(blob)
  if (url) {
    URL.revokeObjectURL(url)
    audioUrlCache.delete(blob)
  }
}

export const playerKeys = {
  all: ['player'] as const,
  file: (fileId: number) => [...playerKeys.all, 'file', fileId] as const,
}

function useFileQuery(fileId: number, enabled = true) {
  return useQuery({
    queryKey: playerKeys.file(fileId),
    enabled,
    queryFn: async () => {
      const file = await DBUtils.getMedia(fileId)
      if (!file) {
        throw new Error('File not found')
      }

      let audioUrl: string | null = null
      if (file.blob) {
        audioUrl = createAudioUrl(file.blob)
      }

      return { file, audioUrl }
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  })
}

interface UsePlayerDataQueryReturn {
  file: MediaRow | null
  segments: Segment[]
  transcript: SubtitleRow | null
  audioUrl: string | null
  loading: boolean
  error: string | null
  retry: () => void
  postProcessStatus: 'pending' | 'completed' | 'failed' | undefined
}

export function usePlayerDataQuery(fileId: string): UsePlayerDataQueryReturn {
  const parsedFileId = Number.parseInt(fileId, 10)
  const isValidFileId = Number.isFinite(parsedFileId) && parsedFileId > 0

  const fileQuery = useFileQuery(parsedFileId, isValidFileId)
  const file = fileQuery.data?.file || null
  const audioUrl = fileQuery.data?.audioUrl || null

  const transcriptionQuery = useTranscriptionStatus(parsedFileId, isValidFileId)
  const transcript = transcriptionQuery.data?.transcript || null
  const segments = transcriptionQuery.data?.segments || []
  const postProcessStatus = transcriptionQuery.data?.postProcessStatus

  const { startTranscription } = useFileStatusManager(isValidFileId ? parsedFileId : 0)
  const autoTranscribingRef = useRef(false)
  const currentBlobRef = useRef<Blob | undefined>(undefined)

  useEffect(() => {
    if (!isValidFileId) return
    if (autoTranscribingRef.current) return
    if (fileQuery.isLoading || fileQuery.error) return
    if (transcriptionQuery.isLoading) return

    const hasTranscript = transcript !== null
    const isProcessing = transcript?.status === 'processing'

    if (!hasTranscript && !isProcessing) {
      autoTranscribingRef.current = true
      startTranscription().finally(() => {
        autoTranscribingRef.current = false
      })
    }
  }, [
    isValidFileId,
    transcript,
    fileQuery.isLoading,
    fileQuery.error,
    transcriptionQuery.isLoading,
    startTranscription,
  ])

  useEffect(() => {
    const blob = file?.blob
    currentBlobRef.current = blob

    return () => {
      if (blob) {
        revokeAudioUrl(blob)
      }
    }
  }, [file?.blob])

  // Extra safety: clean up on unmount even if blob reference hasn't changed
  useEffect(() => {
    return () => {
      if (currentBlobRef.current) {
        revokeAudioUrl(currentBlobRef.current)
      }
    }
  }, [])

  const loading = isValidFileId ? fileQuery.isLoading : false
  const error = isValidFileId ? fileQuery.error?.message || null : 'Invalid file ID'

  const retry = useCallback(() => {
    if (!isValidFileId) return
    fileQuery.refetch()
    transcriptionQuery.refetch()
  }, [isValidFileId, fileQuery, transcriptionQuery])

  return {
    file,
    segments,
    transcript,
    audioUrl,
    loading,
    error,
    retry,
    postProcessStatus,
  }
}
