const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/
const ALLOWED_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
])

/**
 * 从 YouTube URL 提取 11 位 videoId。
 * 返回值同时是安全边界：调用方可以信任它只含 [A-Za-z0-9_-]，
 * 可安全用于 yt-dlp execFile 参数与 IFrame videoId。
 */
export function extractVideoId(input: string): string | null {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) return null

  let candidate: string | null = null
  if (url.hostname === 'youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null
  } else if (url.pathname === '/watch') {
    candidate = url.searchParams.get('v')
  } else if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) {
    candidate = url.pathname.split('/')[2] ?? null
  }

  return candidate && VIDEO_ID_RE.test(candidate) ? candidate : null
}

export function isValidVideoId(id: string): boolean {
  return VIDEO_ID_RE.test(id)
}
