import type { TranslationKey } from '~/lib/i18n/translations'

/**
 * 客户端认识的错误码。**只登记 Worker 真的会返回的码**。
 *
 * 这里曾登记 7 个 Worker 永不返回的码（`AUDIO_TOO_LARGE`、`VIDEO_TOO_LONG`、
 * `EXTRACTOR_UNAVAILABLE`、`YT_BLOCKED`、`VIDEO_UNAVAILABLE`、`QUOTA_EXHAUSTED`、
 * `SERVER_BUSY`）。它们是音频上传 / Whisper 转写 / 服务端队列那个时代的残留，
 * 对应的 4 语种文案也一并删掉了 —— 其中 `VIDEO_TOO_LONG` 的文案还在说
 * 「无字幕视频暂只支持 30 分钟以内」、`EXTRACTOR_UNAVAILABLE` 还在说
 * 「服务器未配置转写组件」，等于**持续向用户承诺已经不存在的功能**。
 *
 * 要重新加一个码，必须同时满足两件事：Worker 真的会返回它，以及四个语种都补上文案。
 * 未登记的码会回落到 `EXTRACTOR_FAILED`，不会白屏，所以只加一半是没意义的。
 */
const KNOWN_CODES = new Set([
  'INVALID_URL',
  'VIDEO_NOT_FOUND',
  'LIVE_NOT_SUPPORTED',
  'EXTRACTOR_FAILED',
  // 无字幕视频走这条：它曾不在已知码里，于是显示成通用的「获取失败，请重试」——
  // 而这个情况下重试永远不会成功，用户需要的是「这个视频没有字幕」。
  'NO_CAPTIONS',
  'RATE_LIMITED',
])

export function youtubeErrorMessageKey(code: string | undefined): keyof TranslationKey {
  return (
    code && KNOWN_CODES.has(code) ? `import.error.${code}` : 'import.error.EXTRACTOR_FAILED'
  ) as keyof TranslationKey
}
