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
  'QUOTA_EXHAUSTED',
  'SERVER_BUSY',
  'RATE_LIMITED',
])

export function youtubeErrorMessageKey(code: string | undefined): string {
  return code && KNOWN_CODES.has(code) ? `import.error.${code}` : 'import.error.EXTRACTOR_FAILED'
}
