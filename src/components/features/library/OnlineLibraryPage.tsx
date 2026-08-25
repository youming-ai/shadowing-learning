import { useState } from 'react'
import { MediaLibraryGrid } from '~/components/features/library/MediaLibraryGrid'
import { YouTubeImportDialog } from '~/components/features/library/YouTubeImportDialog'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { Button } from '~/components/ui/button'
import { PageLoadingState } from '~/components/ui/LoadingState'
import { useFiles } from '~/hooks/db/useFiles'

export function OnlineLibraryPage() {
  const { t } = useI18n()
  const { files: media, isLoading, deleteFile } = useFiles('youtube')
  const [importOpen, setImportOpen] = useState(false)

  if (isLoading) return <PageLoadingState />

  return (
    <div className="flex flex-col gap-4">
      {/* 内容源子 tab：YouTube 激活，播客预留 disabled */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-sm font-medium text-[var(--color-primary)]">
          {t('online.tab.youtube')}
        </span>
        <span
          className="cursor-not-allowed rounded-full px-3 py-1 text-sm text-[var(--text-tertiary)]"
          title={t('online.tab.podcastSoon')}
        >
          {t('online.tab.podcast')}
          <span className="ml-1 text-xs">· {t('online.tab.podcastSoon')}</span>
        </span>
      </div>

      <MediaLibraryGrid
        media={media}
        title={t('online.title')}
        searchPlaceholder={t('library.search.placeholder')}
        onDelete={(id) => void deleteFile(String(id))}
        addSlot={
          <Button onClick={() => setImportOpen(true)}>
            <span className="material-symbols-outlined mr-1 text-base">add</span>
            {t('library.add')}
          </Button>
        }
        emptyState={
          <>
            <p className="text-base font-medium text-[var(--text-primary)]">
              {t('online.empty.title')}
            </p>
            <Button onClick={() => setImportOpen(true)}>{t('online.empty.cta')}</Button>
          </>
        }
      />

      <YouTubeImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
