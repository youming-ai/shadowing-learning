import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DBUtils } from '~/lib/db/db'
import { useFiles } from '../useFiles'

vi.mock('~/lib/db/db', () => ({
  DBUtils: {
    listMedia: vi.fn(),
    deleteMedia: vi.fn(),
  },
  db: {},
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function youtubeRow(id: number, title: string, externalId: string) {
  return {
    id,
    kind: 'youtube' as const,
    title,
    durationSec: 10,
    addedAt: new Date(),
    updatedAt: new Date(),
    externalId,
  }
}

describe('useFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(DBUtils.listMedia as ReturnType<typeof vi.fn>).mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化', () => {
    it('should load files on mount', async () => {
      const mockFiles = [
        youtubeRow(1, 'video-1', 'aaaaaaaaaaa'),
        youtubeRow(2, 'video-2', 'bbbbbbbbbbb'),
      ]
      ;(DBUtils.listMedia as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles)

      const { result } = renderHook(() => useFiles(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(DBUtils.listMedia).toHaveBeenCalled()
      expect(result.current.files).toEqual(mockFiles)
    })

    it('should set isLoading to true during load', async () => {
      ;(DBUtils.listMedia as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
      )

      const { result } = renderHook(() => useFiles(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should handle load error', async () => {
      const errorMessage = 'Database connection failed'
      ;(DBUtils.listMedia as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useFiles(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage)
      })

      expect(result.current.files).toEqual([])
    })
  })

  describe('deleteFile', () => {
    it('should delete file and refresh list', async () => {
      ;(DBUtils.listMedia as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([youtubeRow(1, 'video-1', 'aaaaaaaaaaa')])
        .mockResolvedValueOnce([])
      ;(DBUtils.deleteMedia as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

      const { result } = renderHook(() => useFiles(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.files.length).toBe(1)
      })

      await act(async () => {
        await result.current.deleteFile('1')
      })

      expect(DBUtils.deleteMedia).toHaveBeenCalledWith(1)

      await waitFor(() => {
        expect(result.current.files.length).toBe(0)
      })
    })

    it('should handle invalid file id', async () => {
      const { result } = renderHook(() => useFiles(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.deleteFile('invalid')
      })

      expect(DBUtils.deleteMedia).not.toHaveBeenCalled()
    })

    it('should handle delete error', async () => {
      const errorMessage = 'File not found'
      ;(DBUtils.deleteMedia as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error(errorMessage),
      )

      const { result } = renderHook(() => useFiles(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      let caughtError: Error | undefined

      try {
        await act(async () => {
          await result.current.deleteFile('1')
        })
      } catch (err) {
        caughtError = err as Error
      }

      expect(caughtError).toBeDefined()
    })
  })

  describe('refreshFiles', () => {
    it('should reload files', async () => {
      const { result } = renderHook(() => useFiles(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(DBUtils.listMedia).toHaveBeenCalled()

      await act(async () => {
        await result.current.refreshFiles()
      })
    })
  })

  describe('kind filter', () => {
    it('filters media by kind when a kind arg is passed', async () => {
      const allMedia = [
        youtubeRow(1, 'video-1', 'aaaaaaaaaaa'),
        youtubeRow(2, 'video-2', 'bbbbbbbbbbb'),
      ]
      ;(DBUtils.listMedia as ReturnType<typeof vi.fn>).mockResolvedValue(allMedia)

      const { result: online } = renderHook(() => useFiles('youtube'), {
        wrapper: createWrapper(),
      })
      await waitFor(() => expect(online.current.files).toHaveLength(2))
      expect(online.current.files[0].kind).toBe('youtube')

      const { result: all } = renderHook(() => useFiles(), { wrapper: createWrapper() })
      await waitFor(() => expect(all.current.files).toHaveLength(2))
    })
  })
})
