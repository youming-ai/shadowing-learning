# 子项目 1:字幕抓取改用 yt-dlp(设计)

> 日期:2026-07-07 · 分支:feat/shadowing
> 上位背景:VPS → Cloudflare 混合迁移,共两个子项目。本文是**子项目 1**。

## 背景

`/api/youtube/captions` 现在用 youtubei.js 的 `get_transcript` 面板接口取字幕内容,已实测对 `youtubei/v1/get_transcript` 返回 **400**(视频 `rKV5JcALQoQ`)。

实测结论(有证据):

- **timedtext 直链**:youtubei.js 各客户端(WEB/ANDROID/IOS/TV/MWEB)都返回 `200` 但 **0 字节**——base_url 被 PoToken 封。
- **yt-dlp**:用 `android_vr` 客户端成功下载完整字幕(json3),该客户端当前未被 PoToken 封。
- 差异根因:youtubei.js 拿不到 `android_vr` 客户端;yt-dlp 有全职社区持续对抗 YouTube 封锁。

因此:youtubei.js 的字幕通路不可靠,改用 yt-dlp。metadata(`getVideoMeta`)走的是 player 接口,**仍可用**,保留。

## 范围

**子项目 1 = 把 captions 的字幕内容抓取从 youtubei.js `get_transcript` 换成 yt-dlp json3。**

- 选轨仍用 youtubei:`getVideoMeta` + `selectCaptionTrack`(踩在还能用的部分)。
- 单文件封装新增 + 一处调用点替换,**不改路由响应契约**。
- 网关鉴权 / CORS / VPS 瘦身**不在本子项目**——CF 调用时才需要,归子项目 2(YAGNI)。

## 架构与数据流

```
captions.ts:
  getVideoMeta ──▶ selectCaptionTrack ──▶ [新] fetchSubtitleCues(videoId, lang, kind)
    (youtubei)       (现有 5 级优先)          │  execFile yt-dlp → json3 → MsCue[]
                                              ▼
                          mergeShortCues(msCuesToSeconds()) ──▶ apiSuccess({language,kind,segments})
```

响应契约不变:`apiSuccess({ language: track.language, kind: track.kind, segments })`。

## 实现

### 新增 `fetchSubtitleCues(videoId, language, kind)`(`src/lib/youtube/ytdlp.ts`)

复刻 `downloadAudio` 的全部安全模式:

- `execFile('yt-dlp', [...], { timeout })`,`--` 防注入,`isValidVideoId` 白名单校验 videoId。
- 输出到**唯一 tmp 目录**(`join(tmpdir(), 'yt-sub-<videoId>-<uuid>')`)。不预测文件名——yt-dlp 按 `.<lang>.json3` 命名,lang 码可能和 youtubei 的不完全一致;跑完读目录内的 `*.json3`。
- 参数:
  - `kind === 'manual'` → `--write-subs`;`kind === 'asr'` → `--write-auto-subs`
  - `--sub-langs "<base>.*,<base>"`(`base` = `language.split('-')[0]`,宽松匹配规避 `en` vs `en-US` 码差)
  - `--sub-format json3`、`--skip-download`、`-o <目录模板>`、`--`、`videoId`
- 解析 json3:`events` 中含 `segs` 的项 →
  ```
  { startMs: e.tStartMs,
    endMs: e.tStartMs + e.dDurationMs,
    text: e.segs.map(s => s.utf8).join('').replace(/\s+/g, ' ').trim() }
  ```
  文本为空则跳过。
- `finally` 递归删 tmp 目录(`rm(dir, { recursive: true, force: true }).catch(()=>{})`)。

json3 结构(已实测):
```json
{ "events": [ { "tStartMs": 292, "dDurationMs": 2000, "segs": [{ "utf8": "Think of the mind like an ocean." }] } ] }
```

### 改 `captions.ts`

- `const cues = await fetchTranscriptCues(videoId, track.displayName)`
  → `const cues = await fetchSubtitleCues(videoId, track.language, track.kind)`
- 在选轨前加 `isYtdlpAvailable()` 检查(与 `transcribe.ts` 一致),未装返回 `EXTRACTOR_UNAVAILABLE` (501)。
- 其余(选轨、`mergeShortCues`、错误 catch、响应体)不动。

## 错误处理(顺带修好原始兜底 bug)

| 情形 | 结果 | 说明 |
|---|---|---|
| yt-dlp 退出 0 但无 json3 产出 | `NO_CAPTIONS` (404) | 该视频确无此语言字幕 → **客户端现有 Whisper 兜底接管** |
| yt-dlp 报风控(`sign in`/`bot`/`login`) | `YT_BLOCKED` (502) | 不浪费 Whisper 配额 |
| 其余 yt-dlp 失败 | `EXTRACTOR_FAILED` (502) | 复用 `YtdlpError` |

**原始 bug 的结构性修复**:以前 `get_transcript` 400 被 `classifyYouTubeError` 误判成 `EXTRACTOR_FAILED`,客户端只在 `NO_CAPTIONS` 时兜底 → 死在 `failed`。现在"取不到字幕"统一降级为 `NO_CAPTIONS`,兜底自动触发。

## 测试

- **json3 解析器单测**(非平凡逻辑,必须有):用真实样本 fixture → 断言 `MsCue[]`,覆盖多行 `\n` 合并、空 seg 跳过、`tStartMs+dDurationMs` 计算。
- 更新 `src/routes/api/youtube/__tests__/captions.test.ts`:mock 从 `fetchTranscriptCues` 改为 `fetchSubtitleCues`。

## 删除 / 推迟

- **删**:`innertube.ts` 的 `fetchTranscriptCues` 及其 get_transcript 相关注释(唯一调用点替换后即死代码)。保留 `getVideoMeta`/`classifyYouTubeError`/`mapCaptionTracks`。
- **推迟到子项目 2**:网关鉴权 token、CORS、VPS 瘦身。

## 已知考量

- ASR 自动字幕的 json3 偶带滚动/词级重复事件,可能偏碎;`mergeShortCues` 兜住大部分,实测仍碎再在实现期细化。
- yt-dlp 必须在运行环境可用(Dockerfile 已装,`YTDLP_VERSION` 已 pin)。本地 dev 需 `brew install yt-dlp`,否则该路由返回 501(与 transcribe 一致)。
