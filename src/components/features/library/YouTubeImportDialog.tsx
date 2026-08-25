import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { ImportError, useMediaImport } from '~/hooks/media/useMediaImport'
import { youtubeErrorMessageKey } from '~/lib/youtube/error-messages'

interface YouTubeImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function YouTubeImportDialog({ open, onOpenChange }: YouTubeImportDialogProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const { stage, importYouTubeUrl } = useMediaImport()
  const busy = stage !== 'idle'

  const handleImport = async () => {
    if (!url.trim() || busy) return
    try {
      const mediaId = await importYouTubeUrl(url.trim())
      onOpenChange(false)
      setUrl('')
      navigate({ to: '/watch/$mediaId', params: { mediaId: String(mediaId) } })
    } catch (error) {
      const code = error instanceof ImportError ? error.code : undefined
      toast.error(t(youtubeErrorMessageKey(code)))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('import.tab.youtube')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
