/**
 * YouTube 链接 → video id 的解析。
 *
 * 单独成模块（而不是留在路由文件里）：路由文件要 import `youtubei.js`（重、且依赖运行时 API），
 * 把纯解析逻辑分开才能直接单测，也避免测试为了一个字符串函数去加载整个 Innertube。
 */

/** YouTube video id 的固定形状：11 位 URL-safe base64 字符。*/
export const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/

/**
 * YouTube 的各级域名：`youtube.com`、地区域名（`youtube.com.au` / `youtube.co.uk` / `youtube.de`…）、
 * `youtube-nocookie.com`，以及任意子域（`www` / `m` / `music`）。
 *
 * 刻意**不收紧**成只认 `youtube.com`：旧实现是 `hostname.includes('youtube.com')`，地区域名
 * 本来能用；收紧会把 `youtube.com.au` 这类真实链接判成 `INVALID_URL`，属于把可用输入变成报错。
 *
 * 这里也**不需要**防域名伪装：我们只从链接里取一个 11 位 id，从不请求该域名（真正的请求是
 * youtubei.js 拿 id 发出的），所以伪装域名最多导致后续解析失败，没有安全后果。
 * 「绝不误伤真实链接」比「严格白名单」更划算。
 */
const YOUTUBE_HOST_PATTERN = /(^|\.)youtube(-nocookie)?(\.[a-z]{2,3})+$/i

/**
 * 从路径里取第一个合法的 11 位片段。
 *
 * 覆盖 `/shorts/<id>`、`/embed/<id>`、`/live/<id>`、`/v/<id>` 这些**路径式**链接 ——
 * 它们都没有 `?v=`，只认 query 参数会把一大批合法链接误判成 INVALID_URL。
 * 「取第一个合法片段」而不是按前缀白名单，是为了让 YouTube 以后再新增路径前缀时不必改代码。
 */
function videoIdFromPath(pathname: string): string | null {
  for (const segment of pathname.split('/')) {
    if (VIDEO_ID_PATTERN.test(segment)) return segment
  }
  return null
}

/**
 * 解析出 video id；无法识别时返回 null（由调用方报 INVALID_URL）。
 *
 * 每个分支都**校验** 11 位形状后才返回：以前 `?v=` 是原样返回的，于是 `?v=abc`
 * 会带着一个残缺 id 一路走到 Innertube，最后报成上游故障而不是「链接不合法」。
 */
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim()

  // 直接粘贴 id 本身
  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  // 只认 http(s)：`ftp://youtu.be/<id>` 之类同样能解析出 hostname，但不该被当成可用的视频链接
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  if (url.hostname === 'youtu.be') {
    const [id] = url.pathname.split('/').filter(Boolean)
    return id && VIDEO_ID_PATTERN.test(id) ? id : null
  }

  if (!YOUTUBE_HOST_PATTERN.test(url.hostname)) return null

  const fromQuery = url.searchParams.get('v')
  if (fromQuery && VIDEO_ID_PATTERN.test(fromQuery)) return fromQuery

  return videoIdFromPath(url.pathname)
}
