import { Link } from '@tanstack/react-router'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import type { MediaRow } from '~/types/db/database'

interface MediaCardProps {
  media: MediaRow
  onDelete: (id: number) => void
}

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, '0')
  return `${m}:${s}`
}

function relativeTime(date: Date, locale: string): string {
  const diffMs = date.getTime() - Date.now()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const hours = Math.round(diffMs / 3_600_000)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(hours / 24), 'day')
}

export function MediaCard({ media, onDelete }: MediaCardProps) {
  const { t, currentLanguage } = useI18n()

  return (
    <div className="group relative">
      <Link
        to="/watch/$mediaId"
        params={{ mediaId: String(media.id) }}
        className="block overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-card)] transition-shadow hover:shadow-[var(--shadow-md)]"
      >
        <div className="relative aspect-video w-full bg-[var(--surface-muted)]">
          {media.kind === 'youtube' && media.thumbnailUrl ? (
            <img
              src={media.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="material-symbols-outlined text-5xl text-[var(--text-tertiary)]">
                music_note
              </span>
            </div>
          )}
          {media.durationSec ? (
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-xs text-white">
              {formatDuration(media.durationSec)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 px-3 py-2.5">
          <p className="line-clamp-2 font-heading text-sm font-semibold text-[var(--text-primary)]">
            {media.title}
          </p>
          <p className="truncate text-xs text-[var(--text-secondary)]">
            {media.kind === 'youtube' ? media.channelName : media.fileName}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {relativeTime(media.addedAt, currentLanguage)}
          </p>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => {
          if (media.id && window.confirm(t('library.deleteConfirm'))) onDelete(media.id)
        }}
        className="absolute right-2 top-2 hidden h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex"
        aria-label={t('common.delete')}
      >
        <span className="material-symbols-outlined text-base">delete</span>
      </button>
    </div>
  )
}
