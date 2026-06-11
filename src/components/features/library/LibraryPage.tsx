import { useMemo, useState } from 'react'
import { MediaCard } from '~/components/features/library/MediaCard'
import { MediaImportDialog } from '~/components/features/library/MediaImportDialog'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { PageLoadingState } from '~/components/ui/LoadingState'
import { useFiles } from '~/hooks/db/useFiles'

export function LibraryPage() {
  const { t } = useI18n()
  const { files: mediaList, isLoading, deleteFile } = useFiles()
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return mediaList
    return mediaList.filter(
      (m) => m.title.toLowerCase().includes(q) || (m.channelName ?? '').toLowerCase().includes(q),
    )
  }, [mediaList, search])

  if (isLoading) return <PageLoadingState />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('library.title')}</h1>
        <div className="flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('library.search.placeholder')}
            className="w-56"
          />
          <Button onClick={() => setImportOpen(true)}>
            <span className="material-symbols-outlined mr-1 text-base">add</span>
            {t('library.add')}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--border-primary)] py-20">
          <p className="text-base font-medium text-[var(--text-primary)]">
            {t('library.empty.title')}
          </p>
          <Button onClick={() => setImportOpen(true)}>{t('library.empty.cta')}</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((media) => (
            <MediaCard
              key={media.id}
              media={media}
              onDelete={(id) => void deleteFile(String(id))}
            />
          ))}
        </div>
      )}

      <MediaImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
