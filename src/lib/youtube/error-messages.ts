import type { TranslationKey } from '~/lib/i18n/translations'

const KNOWN_CODES = new Set([
  'INVALID_URL',
  'VIDEO_NOT_FOUND',
  'VIDEO_UNAVAILABLE',
  'LIVE_NOT_SUPPORTED',
  'VIDEO_TOO_LONG',
  'AUDIO_TOO_LARGE',
  'YT_BLOCKED',
  'EXTRACTOR_UNAVAILABLE',
  'EXTRACTOR_FAILED',
  // 无字幕视频走这条：以前不在已知码里，于是显示成通用的「获取失败，请重试」——
  // 而这个情况下重试永远不会成功，用户需要的是「这个视频没有字幕」。
  'NO_CAPTIONS',
  'QUOTA_EXHAUSTED',
  'SERVER_BUSY',
  'RATE_LIMITED',
])

export function youtubeErrorMessageKey(code: string | undefined): keyof TranslationKey {
  return (
    code && KNOWN_CODES.has(code) ? `import.error.${code}` : 'import.error.EXTRACTOR_FAILED'
  ) as keyof TranslationKey
}
