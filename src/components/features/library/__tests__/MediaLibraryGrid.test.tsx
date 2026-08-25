import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MediaLibraryGrid } from '~/components/features/library/MediaLibraryGrid'
import { I18nProvider } from '~/components/layout/contexts/I18nContext'
import { TranscriptionLanguageProvider } from '~/components/layout/contexts/TranscriptionLanguageContext'
import type { MediaRow } from '~/types/db/database'

// MediaCard renders a <Link> from @tanstack/react-router. The global mock in
// setup.ts covers navigation hooks but not Link; override it here to avoid
// requiring a real RouterProvider in these unit tests.
vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: {}, hash: '' }),
    useSearch: () => ({}),
    useParams: () => ({}),
    Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <a href="/" className={className}>
        {children}
      </a>
    ),
  }
})

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TranscriptionLanguageProvider>
      <I18nProvider>{children}</I18nProvider>
    </TranscriptionLanguageProvider>
  )
}

const media: MediaRow[] = [
  {
    id: 1,
    kind: 'youtube',
    title: 'WWDC recap',
    channelName: 'MKBHD',
    durationSec: 90,
    addedAt: new Date(),
    updatedAt: new Date(),
    externalId: 'aaaaaaaaaaa',
    thumbnailUrl: '',
  },
  {
    id: 2,
    kind: 'youtube',
    title: 'Cooking show',
    channelName: 'Chef',
    durationSec: 120,
    addedAt: new Date(),
    updatedAt: new Date(),
    externalId: 'bbbbbbbbbbb',
    thumbnailUrl: '',
  },
]

describe('MediaLibraryGrid', () => {
  it('renders a card per media item', () => {
    render(
      <MediaLibraryGrid
        media={media}
        title="Discover"
        searchPlaceholder="search"
        addSlot={<button type="button">add</button>}
        emptyState={<div>empty</div>}
        onDelete={vi.fn()}
      />,
      { wrapper: Providers },
    )
    expect(screen.getByText('WWDC recap')).toBeInTheDocument()
    expect(screen.getByText('Cooking show')).toBeInTheDocument()
  })

  it('filters by search over title/channel', async () => {
    render(
      <MediaLibraryGrid
        media={media}
        title="Discover"
        searchPlaceholder="search"
        addSlot={<button type="button">add</button>}
        emptyState={<div>empty</div>}
        onDelete={vi.fn()}
      />,
      { wrapper: Providers },
    )
    await userEvent.type(screen.getByPlaceholderText('search'), 'cooking')
    expect(screen.queryByText('WWDC recap')).not.toBeInTheDocument()
    expect(screen.getByText('Cooking show')).toBeInTheDocument()
  })

  it('shows the empty state when there is no media', () => {
    render(
      <MediaLibraryGrid
        media={[]}
        title="Discover"
        searchPlaceholder="search"
        addSlot={<button type="button">add</button>}
        emptyState={<div>nothing here</div>}
        onDelete={vi.fn()}
      />,
      { wrapper: Providers },
    )
    expect(screen.getByText('nothing here')).toBeInTheDocument()
  })
})
