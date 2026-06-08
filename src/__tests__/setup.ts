import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Vitest provides the DOM via `environment: 'happy-dom'` in vitest.config.ts,
// so document/window/HTMLElement/etc. are already on globalThis. We only need
// to (a) register jest-dom matchers (done by the import above), (b) ensure
// URL.createObjectURL / revokeObjectURL exist for the audio blob-URL paths,
// and (c) reset the DOM and mocks between tests.

if (typeof globalThis.URL.createObjectURL !== 'function') {
  let counter = 0
  globalThis.URL.createObjectURL = (_object: Blob | MediaSource): string =>
    `blob:vitest/${counter++}`
  globalThis.URL.revokeObjectURL = (_url: string): void => {}
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock @tanstack/react-router so components/hooks that pull navigation helpers
// render without a real router. vi.importActual is restored under Vitest.
vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: {}, hash: '' }),
    useSearch: () => ({}),
    useParams: () => ({}),
  }
})

// Mock sonner toast (user-visible notifications) to inert spies.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))
