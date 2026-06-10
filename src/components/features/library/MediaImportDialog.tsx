'use client'

import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import FileUpload from '~/components/features/file/FileUpload'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useFiles } from '~/hooks/db/useFiles'
import { ImportError, useMediaImport } from '~/hooks/media/useMediaImport'
import { youtubeErrorMessageKey } from '~/lib/youtube/error-messages'

interface MediaImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MediaImportDialog({ open, onOpenChange }: MediaImportDialogProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const { stage, importYouTubeUrl } = useMediaImport()
  const { addFiles, files } = useFiles()
  const [uploading, setUploading] = useState(false)

  const busy = stage !== 'idle'

  const handleImport = async () => {
    if (!url.trim() || busy) return
    try {
      const mediaId = await importYouTubeUrl(url.trim())
      onOpenChange(false)
      setUrl('')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate({ to: '/watch/$mediaId' as any, params: { mediaId: String(mediaId) } as any })
    } catch (error) {
      const code = error instanceof ImportError ? error.code : undefined
      toast.error(t(youtubeErrorMessageKey(code)))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('library.add')}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="youtube">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="youtube">{t('import.tab.youtube')}</TabsTrigger>
            <TabsTrigger value="upload">{t('import.tab.upload')}</TabsTrigger>
          </TabsList>
          <TabsContent value="youtube" className="flex flex-col gap-3 pt-4">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('import.url.placeholder')}
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              disabled={busy}
            />
            <Button onClick={handleImport} disabled={busy || !url.trim()}>
              {stage === 'resolving'
                ? t('import.resolving')
                : stage === 'saving'
                  ? t('import.saving')
                  : t('import.submit')}
            </Button>
          </TabsContent>
          <TabsContent value="upload" className="pt-4">
            <FileUpload
              onFilesSelected={async (selected) => {
                setUploading(true)
                try {
                  await addFiles(selected)
                  onOpenChange(false)
                } finally {
                  setUploading(false)
                }
              }}
              isUploading={uploading}
              currentFileCount={files.length}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
