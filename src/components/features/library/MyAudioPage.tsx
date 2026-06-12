import { useState } from 'react'
import { AudioUploadDialog } from '~/components/features/library/AudioUploadDialog'
import { MediaLibraryGrid } from '~/components/features/library/MediaLibraryGrid'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { Button } from '~/components/ui/button'
import { PageLoadingState } from '~/components/ui/LoadingState'
import { useFiles } from '~/hooks/db/useFiles'

export function MyAudioPage() {
  const { t } = useI18n()
  const { files: media, isLoading, deleteFile } = useFiles('audio')
  const [uploadOpen, setUploadOpen] = useState(false)

  if (isLoading) return <PageLoadingState />

  return (
    <div className="flex flex-col gap-4">
      <MediaLibraryGrid
        media={media}
        title={t('myaudio.title')}
        searchPlaceholder={t('library.search.placeholder')}
        onDelete={(id) => void deleteFile(String(id))}
        addSlot={
          <Button onClick={() => setUploadOpen(true)}>
            <span className="material-symbols-outlined mr-1 text-base">upload</span>
            {t('myaudio.upload')}
          </Button>
        }
        emptyState={
          <>
            <p className="text-base font-medium text-[var(--text-primary)]">
              {t('myaudio.empty.title')}
            </p>
            <Button onClick={() => setUploadOpen(true)}>{t('myaudio.empty.cta')}</Button>
          </>
        }
      />

      <AudioUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  )
}
