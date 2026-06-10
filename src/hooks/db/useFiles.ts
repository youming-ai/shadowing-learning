import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { DBUtils } from '~/lib/db/db'
import type { MediaRow } from '~/types/db/database'

export const filesKeys = {
  all: ['files'] as const,
}

export interface AddFilesOptions {
  onProgress?: (uploaded: number, total: number) => void
}

export interface UseFilesReturn {
  files: MediaRow[]
  isLoading: boolean
  refreshFiles: () => Promise<void>
  addFiles: (files: File[], options?: AddFilesOptions) => Promise<void>
  deleteFile: (fileId: string) => Promise<void>
  error: string | null
}

export function useFiles(): UseFilesReturn {
  const queryClient = useQueryClient()

  const {
    data: files = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: filesKeys.all,
    queryFn: async () => {
      return await DBUtils.listMedia()
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
  })

  const errorMessage = error instanceof Error ? error.message : null

  const refreshFiles = useCallback(async () => {
    await refetch()
  }, [refetch])

  const addFilesMutation = useMutation({
    mutationFn: async ({
      files: newFiles,
      options,
    }: {
      files: File[]
      options?: AddFilesOptions
    }) => {
      const total = newFiles.length
      options?.onProgress?.(0, total)
      let uploaded = 0
      for (const file of newFiles) {
        const now = new Date()
        // 本期上传入口仅支持音频；若未来支持视频文件需按 file.type 推断 kind
        await DBUtils.addMedia({
          kind: 'audio',
          title: file.name,
          durationSec: null,
          addedAt: now,
          updatedAt: now,
          blob: file,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        })
        uploaded += 1
        options?.onProgress?.(uploaded, total)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: filesKeys.all })
    },
  })

  const addFiles = useCallback(
    async (newFiles: File[], options?: AddFilesOptions) => {
      await addFilesMutation.mutateAsync({ files: newFiles, options })
    },
    [addFilesMutation],
  )

  const deleteFileMutation = useMutation({
    mutationFn: async (id: number) => {
      await DBUtils.deleteMedia(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: filesKeys.all })
    },
  })

  const deleteFile = useCallback(
    async (fileId: string) => {
      const id = parseInt(fileId, 10)
      if (!Number.isNaN(id)) {
        await deleteFileMutation.mutateAsync(id)
      }
    },
    [deleteFileMutation],
  )

  return {
    files,
    isLoading,
    refreshFiles,
    addFiles,
    deleteFile,
    error: errorMessage,
  }
}
