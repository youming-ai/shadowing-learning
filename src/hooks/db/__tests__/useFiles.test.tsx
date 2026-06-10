import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DBUtils } from '~/lib/db/db'
import { useFiles } from '../useFiles'

vi.mock('~/lib/db/db', () => ({
  DBUtils: {
    listMedia: vi.fn(),
    addMedia: vi.fn(),
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
        {
          id: 1,
          kind: 'audio',
          title: 'test1.mp3',
          durationSec: null,
          fileSize: 1000,
          mimeType: 'audio/mpeg',
          addedAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          kind: 'audio',
          title: 'test2.mp3',
          durationSec: null,
          fileSize: 2000,
          mimeType: 'audio/mpeg',
          addedAt: new Date(),
          updatedAt: new Date(),
        },
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

  describe('addFiles', () => {
    it('should add files and refresh list', async () => {
      const mockFile = new File(['content'], 'test.mp3', { type: 'audio/mpeg' })
      ;(DBUtils.addMedia as ReturnType<typeof vi.fn>).mockResolvedValue(1)
      ;(DBUtils.listMedia as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 1,
          kind: 'audio',
          title: 'test.mp3',
          durationSec: null,
          fileSize: 7,
          mimeType: 'audio/mpeg',
          addedAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const { result } = renderHook(() => useFiles(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.addFiles([mockFile])
      })

      expect(DBUtils.addMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'test.mp3',
          mimeType: 'audio/mpeg',
          kind: 'audio',
        }),
      )
    })

    it('should handle add error', async () => {
      const errorMessage = 'Storage quota exceeded'
      ;(DBUtils.addMedia as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error(errorMessage),
      )

      const { result } = renderHook(() => useFiles(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const mockFile = new File(['content'], 'test.mp3', { type: 'audio/mpeg' })
      let caughtError: Error | undefined

      try {
        await act(async () => {
          await result.current.addFiles([mockFile])
        })
      } catch (err) {
        caughtError = err as Error
      }

      expect(caughtError).toBeDefined()
    })

    it('should add multiple files', async () => {
      ;(DBUtils.addMedia as ReturnType<typeof vi.fn>).mockResolvedValue(1)

      const { result } = renderHook(() => useFiles(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const files = [
        new File(['content1'], 'test1.mp3', { type: 'audio/mpeg' }),
        new File(['content2'], 'test2.mp3', { type: 'audio/mpeg' }),
      ]

      await act(async () => {
        await result.current.addFiles(files)
      })

      expect(DBUtils.addMedia).toHaveBeenCalledTimes(2)
    })
  })

  describe('deleteFile', () => {
    it('should delete file and refresh list', async () => {
      ;(DBUtils.listMedia as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          {
            id: 1,
            kind: 'audio',
            title: 'test.mp3',
            durationSec: null,
            addedAt: new Date(),
            updatedAt: new Date(),
          },
        ])
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
})
