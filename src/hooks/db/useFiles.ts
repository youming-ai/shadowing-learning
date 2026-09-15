import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { DBUtils } from '~/lib/db/db'
import type { MediaRow } from '~/types/db/database'

export const filesKeys = {
  all: ['files'] as const,
}

export interface UseFilesReturn {
  files: MediaRow[]
  isLoading: boolean
  refreshFiles: () => Promise<void>
  deleteFile: (fileId: string) => Promise<void>
  error: string | null
}

export function useFiles(kind?: MediaRow['kind']): UseFilesReturn {
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
    select: (rows) => (kind ? rows.filter((m) => m.kind === kind) : rows),
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
  })

  const errorMessage = error instanceof Error ? error.message : null

  const refreshFiles = useCallback(async () => {
    await refetch()
  }, [refetch])

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
    deleteFile,
    error: errorMessage,
  }
}
