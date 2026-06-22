import { type ReactNode, useMemo, useState } from 'react'
import { MediaCard } from '~/components/features/library/MediaCard'
import { Input } from '~/components/ui/input'
import type { MediaRow } from '~/types/db/database'

interface MediaLibraryGridProps {
  media: MediaRow[]
  title: string
  searchPlaceholder: string
  addSlot: ReactNode
  emptyState: ReactNode
  onDelete: (id: number) => void
}

export function MediaLibraryGrid({
  media,
  title,
  searchPlaceholder,
  addSlot,
  emptyState,
  onDelete,
}: MediaLibraryGridProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return media
    return media.filter(
      (m) => m.title.toLowerCase().includes(q) || (m.channelName ?? '').toLowerCase().includes(q),
    )
  }, [media, search])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
        <div className="flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-56"
          />
          {addSlot}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--border-primary)] py-20">
          {emptyState}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <MediaCard key={m.id} media={m} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
