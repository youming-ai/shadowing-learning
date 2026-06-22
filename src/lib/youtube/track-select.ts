export interface CaptionTrackMeta {
  language: string // BCP-47 language code（来自 player 响应 caption_tracks.language_code）
  kind: 'manual' | 'asr'
  displayName: string // transcript 面板的 display name（用于 selectLanguage()）
}

interface SelectOptions {
  preferredLanguage?: string
  originalLanguage?: string
}

function baseLang(code: string): string {
  return code.toLowerCase().split('-')[0]
}

function sameLang(a: string | undefined, b: string): boolean {
  return a !== undefined && baseLang(a) === baseLang(b)
}

/** 5 级优先：preferred 手动 > preferred ASR > 原声手动 > 任意手动 > 任意 ASR */
export function selectCaptionTrack(
  tracks: CaptionTrackMeta[],
  { preferredLanguage, originalLanguage }: SelectOptions,
): CaptionTrackMeta | null {
  if (tracks.length === 0) return null
  return (
    tracks.find((t) => t.kind === 'manual' && sameLang(preferredLanguage, t.language)) ??
    tracks.find((t) => t.kind === 'asr' && sameLang(preferredLanguage, t.language)) ??
    tracks.find((t) => t.kind === 'manual' && sameLang(originalLanguage, t.language)) ??
    tracks.find((t) => t.kind === 'manual') ??
    tracks.find((t) => t.kind === 'asr') ??
    null
  )
}
