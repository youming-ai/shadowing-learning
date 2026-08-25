import { useState } from 'react'
import FileUpload from '~/components/features/file/FileUpload'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { useFiles } from '~/hooks/db/useFiles'

interface AudioUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AudioUploadDialog({ open, onOpenChange }: AudioUploadDialogProps) {
  const { t } = useI18n()
  const { addFiles, files } = useFiles()
  const [uploading, setUploading] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('myaudio.upload')}</DialogTitle>
        </DialogHeader>
        <div className="pt-2">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
