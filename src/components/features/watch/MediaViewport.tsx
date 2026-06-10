import type { RefObject } from 'react'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import type { MediaRow } from '~/types/db/database'

interface MediaViewportProps {
  media: MediaRow
  containerRef: RefObject<HTMLDivElement | null>
  embedBlocked: boolean
}

export function MediaViewport({ media, containerRef, embedBlocked }: MediaViewportProps) {
  const { t } = useI18n()

  if (media.kind === 'youtube' && embedBlocked) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl bg-[var(--surface-muted)]">
        <p className="text-sm text-[var(--text-secondary)]">{t('watch.embedBlocked')}</p>
        <a
          href={`https://www.youtube.com/watch?v=${media.externalId}`}
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
        >
          {t('watch.openOnYouTube')}
        </a>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black">
      {media.kind === 'youtube' ? (
        // YT.Player 会把这个 div 替换为 iframe；外层比例容器负责 16:9
        <div className="aspect-video w-full">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-[var(--surface-muted)]">
          <span className="material-symbols-outlined text-7xl text-[var(--text-tertiary)]">
            music_note
          </span>
          {/* AudioFileAdapter 把隐藏 <audio> 挂在这里 */}
          <div ref={containerRef} className="hidden" />
        </div>
      )}
    </div>
  )
}
