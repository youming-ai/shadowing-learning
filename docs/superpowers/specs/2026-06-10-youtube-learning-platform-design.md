# YouTube 学习平台 子项目 #1：YouTube 导入 + 双语播放 — 设计文档

- 日期：2026-06-10
- 状态：已通过多视角对抗审查（45 条发现，42 条吸收，本文为修订版）
- 需求源：`1.md`（Trancy 对标产品设计文档）+ 4 张 Trancy 截图
- 上位决策（已与产品负责人确认）：
  1. **渐进改造**：保留 Bun + Vite + TanStack Start + Dexie 栈，不开新项目、不迁 Next.js/Postgres。
  2. **子项目切片**：本期只做「YouTube 导入 + 双语播放」。Auth、服务端数据库、生词本、订阅频道、字幕设置面板、跟读模式全部推后。
  3. **播放形态**：嵌入 YouTube IFrame + IFrame Player API（与 Trancy 一致）。
  4. **字幕来源**：youtubei.js 抓官方/ASR 字幕；无字幕视频 fallback 到 yt-dlp 提音频 → 现有 Groq Whisper 转写。
  5. **数据模型**：统一为「学习媒体」抽象（media 表），分两阶段迁移（见 Section 2）。

---

## Section 0：Day-1 Spike — VPS 上的 YouTube 可达性验证（决策门）

**这是第 0 号任务，拥有否决 Section 4 方案的权力。**

2024 年起 YouTube 对数据中心 IP 实施 bot 检测/登录墙，Dokploy VPS 正属此类。youtubei.js（InnerTube）与 yt-dlp 两条路径都可能在生产环境第一天就被 403。这不是「长期风险」，是当下前提。

**Spike 内容**（timebox 1 天）：在目标 VPS 上跑一个一次性脚本：

- youtubei.js：`getBasicInfo` / `getInfo` + `getTranscript` 各 20 次（混合冷热门视频）
- yt-dlp：低码率音频下载 20 次（按 Section 4.1③ 的参数）
- 通过标准：两条路径成功率 ≥ 90%

**若被封，对策阶梯**（按成本递增，逐级评估后更新本设计）：

1. 导出浏览器 cookies 供 yt-dlp / youtubei.js 使用
2. PO token provider（如 bgutil-ytdlp-pot-provider）
3. youtubei.js 切换 TV_EMBEDDED 等替代客户端
4. 住宅代理（引入持续成本，需重新评估商业可行性）

无论结果如何，前端都需要 `YT_BLOCKED` 错误态（「服务器暂时无法访问 YouTube」，区别于可重试的 `EXTRACTOR_FAILED`）。

---

## Section 1：范围

### 做（in scope）

1. 资料库页加 YouTube URL 粘贴入口（暂不做推荐/订阅/频道）
2. 服务端用 youtubei.js 抓视频 metadata + 字幕（真实 API 路径见 4.1）
3. 无字幕回退：yt-dlp 低码率提音频 → 复用 Groq Whisper 转写（需先抽取共享模块，见 4.1③）
4. 字幕翻译：服务端 `/api/postprocess` 零改动，**客户端新增分片编排器**（现有端点硬限制 ≤100 段且 ≤1 万字符/请求，见 4.5）
5. 数据层：新建 `media` + `subtitles` 表，**两阶段迁移**（v4 拷贝保留旧表 → 下个发布周期 v5 删表）
6. 路由：`/watch/$mediaId`（旧 `/player/$fileId` 重定向，依赖迁移保留原 id）
7. 播放器：`MediaSourceAdapter` 抽象；YouTube 用 IFrame API，音频复用 `<audio>`
8. 播放页控制条：播放/暂停/进度条/音量改造复用；**上一句/下一句、单句循环开关为新建 UI**；倍速接入现成但从未渲染的 `PlaybackSpeedControl` 组件
9. 安全头：CSP 放行 YouTube iframe 与脚本源（见 4.4）
10. PWA：随发布 bump service worker `CACHE_NAME`（见 6.4）
11. 键盘控制：以死代码 `useKeyboardControls` 的按键表为规格，**首次**接入播放页
12. 复用现有主题/i18n（现状 4 种 UI 语言）/错误处理/toast

UI 交付物按 Trancy 截图：播放页三区布局重做、首页 MediaCard 网格。

**估算**：spike 1 天 + 实施 2.5~3 周。

### 不做（推到子项目 #2 / #3）

- Auth、Postgres、多设备同步
- 生词本 / 句子本 / 历史记录页（单词点击查词整体推后）
- 字幕拆分模式、字幕样式面板、布局切换（默认/剧场/专注）
- 多翻译引擎切换 UI（架构预留，不暴露）
- 推荐频道、订阅、Library Tabs（YouTube/Podcast/合集/电影）
- 跟读模式（现有产品能力，#2/#3 接回）
- StatsCards 挪设置页（本期仅从首页移除，迁移工作推 #2）
- SEO/sitemap、社交分享

---

## Section 2：数据模型与两阶段迁移

### 新表结构

**`media` 表** — 单表 + 可选字段（IndexedDB 无 join；类型层用判别联合收紧）：

```ts
interface MediaRow {
  id?: number
  kind: 'audio' | 'youtube'          // discriminator，未来扩展 'podcast' 等
  title: string
  durationSec: number | null
  addedAt: Date
  updatedAt: Date
  // kind: 'audio' 专属
  blob?: Blob
  fileName?: string
  fileSize?: number
  mimeType?: string
  // kind: 'youtube' 专属
  externalId?: string                // YouTube videoId（11 位）
  channelName?: string
  thumbnailUrl?: string
  sourceUrl?: string
}

type AudioMedia = MediaRow & { kind: 'audio'; blob: Blob }
type YouTubeMedia = MediaRow & { kind: 'youtube'; externalId: string }
```

索引：`'++id, kind, &externalId, addedAt, [kind+addedAt]'`

- `&externalId` **唯一索引**：防并发导入产生重复行。audio 行该字段为 undefined，IndexedDB 不索引缺失值，不冲突。写入捕获 `ConstraintError` → 跳转已有记录。
- `[kind+addedAt]` 用于按类型分组列表。

**`subtitles` 表** — 字段与现有 `TranscriptRow` 对齐，**status 枚举沿用 `'failed'` 字面量**（与全代码库 `ProcessingStatus` 一致，不引入 `'error'` 漂移）：

```ts
interface SubtitleRow {
  id?: number
  mediaId: number
  source: 'official' | 'whisper'     // YouTube 官方字幕 or AI 转写
  status: 'pending' | 'processing' | 'completed' | 'failed'
  sourceLanguage: string
  targetLanguage: string | null      // 翻译目标语言；未翻译/同语言跳过时为 null
  postProcessStatus?: 'pending' | 'completed' | 'failed'   // 保留现有翻译状态机字段
  postProcessError?: string
  rawText?: string                   // whisper 来源保留
  error?: string
  createdAt: Date
  updatedAt: Date
}
```

索引：`'++id, mediaId, status, createdAt'`

**`segments` 表完全不动**：v4 的 schema 字符串**逐字照抄 v3**（含全部既有索引），外键字段名保持 `transcriptId`（语义平移为指向 `subtitles.id`，改名收益纯美观、代价是重写最大的表）。

### 两阶段迁移（v4 拷贝 → v5 删表）

> 审查结论：单版本「删表 + 搬数据」没有任何恢复窗口，localStorage 快照在事务回滚时不回滚、对已删的表不具备恢复能力。改为两阶段。

**本次发布 v4** —— 只建新表 + 拷贝，**旧表保留作只读备份**：

```ts
this.version(4)
  .stores({
    media: '++id, kind, &externalId, addedAt, [kind+addedAt]',
    subtitles: '++id, mediaId, status, createdAt',
    segments: /* 逐字照抄 v3 */,
    files: /* 照抄 v3，保留 */,
    transcripts: /* 照抄 v3，保留 */,
  })
  .upgrade(async (tx) => {
    // 1. files → media（kind:'audio'，bulkAdd 显式带原 id —— ++id 表接受显式主键）
    // 2. transcripts → subtitles（mediaId = fileId，显式带原 id；source:'whisper'）
    // 3. segments 零接触
    // 迁移代码不吞错：失败让 versionchange 事务整体回滚到 v3
  })
```

字段映射表：

| v3 | v4 |
|---|---|
| files.name | media.title 与 media.fileName |
| files.size / type / blob | fileSize / mimeType / blob |
| files.uploadedAt / updatedAt / duration | addedAt / updatedAt / durationSec |
| transcripts.fileId | subtitles.mediaId |
| transcripts.status（'failed' 原样） | subtitles.status |
| transcripts.language | sourceLanguage |
| transcripts.rawText / error / postProcessStatus / postProcessError | 原样平移 |
| —（无从得知历史翻译目标语） | targetLanguage = null，显示逻辑不依赖它 |

**保留原 id** 让 `files→transcripts→segments` 关系链零外键重写地平移为 `media→subtitles→segments`，也是 `/player/$fileId → /watch/$mediaId` 重定向成立的前提。迁移耗时只与 files+transcripts 行数相关（通常 <100 行），与 segments（可能上万行）无关。

**v4 打开成功后**：应用层比对新旧表行数（一次性校验），不一致则 `dbLogger.error` 上报并保留旧表供修复迁移重放——旧表在，hotfix 可重跑。

**下个发布周期 v5**：观察无异常后，`files: null, transcripts: null` 删表。

### 多标签页与版本错误处理

- 在 db.ts 订阅 `db.on('versionchange')`：关闭连接 + 全局提示「应用已更新，请刷新」（Dexie 官方推荐做法）。否则持有 v3 连接的旧标签页会阻塞新标签页升级。
- `Dexie.VersionError` / `DatabaseClosedError` 发生在异步 queryFn，**到不了 React ErrorBoundary**——在 [error-handler.ts](../../../src/lib/utils/error-handler.ts) 的分类表里识别这两类错误，给「请刷新页面」的 toast/错误态文案。

### DBUtils 改造与直连调用点收编

- `addFile/getFile/getAllFiles/deleteFile` → `addMedia/getMedia/listMedia/deleteMedia`（children-first：segments → subtitles → media）
- `findTranscriptByFileId` → `findSubtitleByMediaId`；新增 `findMediaByExternalId`
- **盘点并收编绕过 DBUtils 直连 `db.transcripts`/`db.files` 的调用点**：`useTranscription.ts`（saveTranscriptionResults / updatePostProcessStatus）、`useFileStatus.ts`、`manual-postprocess.ts`——这些是隐藏工作量，计入估算

---

## Section 3：页面与 UI 设计

### 3.1 资料库页 `/`（对照 Trancy 截图②，简化版）

| 区块 | 实现 | 与现有代码关系 |
|---|---|---|
| 顶栏 | `LibraryHeader`：标题 + 添加按钮 + 搜索框 | 新组件；搜索为本地过滤（title/channelName 包含匹配），非 YouTube 搜索 |
| 添加按钮 | `MediaImportDialog`：Tab「YouTube 链接」与「上传音频」（迁入现有 FileUpload 拖放区） | [FileUpload.tsx](../../../src/components/features/file/FileUpload.tsx) 作为 Dialog 内 Tab 保留 |
| MediaCard | 封面图（YouTube 用 thumbnailUrl；音频用音符占位）+ 时长角标 + 标题 + 频道名/文件名 + 相对时间 + hover 删除 | 改写自 FileCard.tsx；点击整卡 → `/watch/$mediaId` |
| 空态 | 插画 + 「粘贴一个 YouTube 链接开始学习」引导 | 新增 |

不做（截图②里属于 #2/#3）：内容类型 Tabs、订阅频道栏、编辑精选/收藏/历史。网格区满宽，不预埋空壳组件。`StatsCards` 本期从首页移除（迁设置页推 #2）。

### 3.2 播放页 `/watch/$mediaId`（对照截图①，三区布局）

| 区块 | 实现 | 与现有代码关系 |
|---|---|---|
| 媒体区 | `MediaViewport`：youtube 渲染 IFrame 容器（16:9）；audio 渲染封面占位 + 隐藏 `<audio>` | 新组件，包住 adapter 挂载点 |
| 当前句区 | `CurrentSentence`：原文大字 + 翻译次级字号 | activeIndex 来自 `lib/player/active-segment.ts`（见 5.3） |
| 字幕列表 | `SubtitlePanel`：时间戳双语行，当前行高亮 + 自动滚动居中，点击行 seek | 改写自 ScrollableSubtitleDisplay.tsx（高亮/滚动/跳转逻辑可迁移，私有二分函数下沉到 active-segment.ts） |
| 底部控制条 | `PlayerControls` | **播放/暂停、进度条、音量**：改造复用现有 PlayerFooter；**上一句/下一句、单句循环开关**：新建（现有的是 ±10 秒跳转和 A/B 两点循环，不是同一物）；**倍速**：接入现成但从未渲染的 PlaybackSpeedControl，档位以 `getAvailablePlaybackRates()` 为准 |
| 右栏头部 | 字幕数 badge + 「重新生成字幕」按钮 | 行为定义见下 |

**「重新生成字幕」行为**：`source === 'official'` → 重抓 `/captions` + 重新翻译（免费）；`source === 'whisper'` → 确认弹窗（提示消耗转写额度）→ 删除旧 subtitle+segments → 重走 `/youtube/transcribe`。列入测试矩阵与 DoD。

**不存在的 mediaId**：复用 PlayerFallbackStates 模式显示「内容不存在」+ 返回资料库，列入 DoD。

响应式：≥1024px 双栏（左 2fr 右 1fr）；窄屏纵向堆叠。截图①中不做：单词查词、收藏心形、跟读麦克风（留图标位不渲染）、AI/默认字幕切换 Tab。

### 3.3 主题、i18n、键盘

- 新组件全用现有 `@theme` token；ThemeDebugger（Ctrl/Cmd+Shift+T）核对四主题
- 新文案 key 按现状 **4 种 UI 语言**补全（以 translations.ts 实际 locale 键为准；第 5 语言韩语是另一项独立工作，不混入）
- 键盘控制：现有 `useKeyboardControls` 是从未接线的死代码——以其按键表（空格/←→等）为规格**首次**接入播放页，验收含键盘项
- 相对时间用 `Intl.RelativeTimeFormat` 跟随 UI 语言

### 3.4 加载与过渡态

- 导入弹窗 stepper 只覆盖「获取视频信息」（resolve + 写库），完成即跳播放页
- 字幕抓取/转写/翻译的进度全部在播放页字幕栏展示。现有转写链路**没有可消费的进度信号**（TranscriptionLoading 是死代码）——用不确定进度呈现：spinner + 阶段文案（「获取字幕 → 转写中 → 翻译中(已完成 n/m 片)」）
- 翻译逐片完成（客户端分片编排，见 4.5）：原文先上屏，翻译列按片补全，没翻完的行只显示原文

---

## Section 4：YouTube 接入层

架构原则：服务器无数据库，API 以 `videoId`（11 位外部 id）为键，服务器是纯无状态代理，存储一律在客户端 IndexedDB。

### 4.1 三个新 API 端点

均为 TanStack Start server handler，Zod + `checkRateLimit` + `apiSuccess`/`apiError`，与现有端点同构。

**① `POST /api/youtube/resolve`** — 解析 URL 返回元数据（要快，<2s）

```
请求 { url }
响应 { videoId, title, channelName, thumbnailUrl, durationSec, isLive,
       captionTracks: Array<{ language, kind: 'manual' | 'asr' }> }
```

服务端 `youtubei.js getBasicInfo()`（captionTracks 来自 player 响应元数据）。客户端拿响应写 media 表（`&externalId` 唯一索引兜底并发去重，ConstraintError → 跳已有记录）。

URL 解析支持 `watch?v=` / `youtu.be/` / `/shorts/` / `/embed/`，videoId 以 `^[A-Za-z0-9_-]{11}$` 严格校验（同时是后续进 yt-dlp 参数的安全边界）。

**② `POST /api/youtube/captions`** — 抓字幕正文

```
请求 { videoId, preferredLanguage? }
响应 { language, kind, segments: [{ start, end, text }] }   // 秒，对齐现有 Segment
```

**真实 API 路径**（审查修正）：`getTranscript()` 必须基于完整 `yt.getInfo(videoId)`（接受其为重请求，这正是 resolve/captions 分离的原因）。**禁用 caption `base_url`（timedtext）直拉**——该路径服务端已被 POT token 封死。轨道选择两步走：用 player 响应的 `caption_tracks` 元数据（language code + kind）按优先级决策——preferredLanguage 手动 > 该语言 ASR > 原声语言手动 > 任意手动 > 任意 ASR——再把决策映射到 transcript 面板的 display name 调 `selectLanguage()`。`get_transcript` 的间歇性 400 是已知现象，归入可重试的 `EXTRACTOR_FAILED`。

归一化：毫秒 offset → 秒；合并过碎行（<1.2s 且无句末标点并入下一段——ASR 字幕碎片化严重，不合并则翻译与逐句学习体验都崩）。

**③ `POST /api/youtube/transcribe`** — 无字幕 fallback（贵路径）

```
请求 { videoId, language? }
响应 与现有 /api/transcribe 相同的 TranscriptionSegment[]
```

前置重构：把 `processTranscription`（含错误分类）从 routes/api/transcribe.ts 抽到共享模块 `lib/ai/groq-whisper.ts`，两个端点共同调用（现 `groq-transcription-utils` 只是响应映射纯函数，不是可直接复用的调用层）。

服务端流程：

```
校验 videoId → 限流 + 并发信号量 + 每日配额（见 4.2）
  → youtubei.js 元数据取 durationSec，>30 分钟拒（VIDEO_TOO_LONG）
  → execFile('yt-dlp', ['-f', 'bestaudio[abr<=64]/worstaudio',
       '--max-filesize', '25M', '--no-part', '-o', tmpPath, '--', videoId])
  → lib/ai/groq-whisper.ts 调 Whisper
  → finally 按前缀 glob 清理 tmpPath*
  → 返回 segments
```

关键参数依据（审查修正）：

- **低码率优先** `bestaudio[abr<=64]/worstaudio`：Whisper 不需要高码率，48-70kbps 下 30 分钟 ≈ 11-16MB，与 25MB 上限自洽（`bestaudio` 默认选最高码率，30 分钟 50-70MB，先下完再拒，纯浪费）
- `--max-filesize 25M` 硬中止兜底；25MB 是 **Groq free tier** 限额（dev tier 100MB），文档按 free tier 保守口径
- `--no-part` 直写目标文件，配合 glob 清理，避免超时杀进程后 `.part` 残留累积
- `execFile` 不走 shell + `--` 防注入；videoId 已白名单校验，双保险
- 同步请求，超时 120s；不做任务队列（单容器低并发；BullMQ 属规模化阶段）

转写完成后客户端走分片翻译（4.5）。

### 4.2 限流与费用防线

| 防线 | 配置 | 防什么 |
|---|---|---|
| per-IP 滑窗（复用 rate-limiter.ts） | /resolve、/captions：20 次/10 分钟；/transcribe：4 次/小时 | 单 IP 滥用 |
| **进程级并发信号量** | /transcribe 同时最多 1 个 yt-dlp+Whisper 任务，超出 429 `SERVER_BUSY` | 容器 CPU/带宽/磁盘被打满 |
| **每日全局配额** | /transcribe 每日 24 次（UTC 日界，进程内计数器），超出 `QUOTA_EXHAUSTED`，当天只支持有字幕视频 | 多 IP 费用攻击 |

后两条均为进程内实现，与单容器部署假设一致。**部署前置条件**：rate-limiter 的 `getClientIdentifier` 信任 `x-forwarded-for` 首元素，依赖 Traefik 正确清洗入站伪造头——写入部署文档。

### 4.3 错误分类

| 错误码 | 触发 | 可重试 |
|---|---|---|
| INVALID_URL | URL 解析失败 | 否 |
| VIDEO_NOT_FOUND | 视频不存在/已删除 | 否 |
| VIDEO_UNAVAILABLE | 私享/区域限制/年龄限制 | 否 |
| LIVE_NOT_SUPPORTED | 直播流 | 否 |
| NO_CAPTIONS | 无字幕轨（前端静默转 Whisper 路径） | — |
| VIDEO_TOO_LONG | >30 分钟且无字幕 | 否 |
| AUDIO_TOO_LARGE | --max-filesize 中止（>25MB） | 否 |
| YT_BLOCKED | 服务端被 YouTube bot 检测拦截（见 Section 0） | 否（提示稍后/换内容） |
| EXTRACTOR_UNAVAILABLE | yt-dlp 二进制缺失（本地 dev 未装） | 否 |
| EXTRACTOR_FAILED | youtubei.js/yt-dlp 其他错误（含 get_transcript 间歇 400） | 是，走 smartRetry |
| SERVER_BUSY / QUOTA_EXHAUSTED | 并发/配额防线 | 是（稍后） |
| RATE_LIMITED | per-IP 限流 | 是 |

前端在 error-handler.ts 分类表加映射 → sonner toast（4 语言）。

### 4.4 Docker、CSP 与环境

- **yt-dlp 安装**：不用 Alpine apk（分支冻结旧版）。Dockerfile 下载 GitHub release 独立二进制，**写死版本号 + 校验和**，升级 = 改一行重建镜像。配置容器内已有的 **Bun 作为 yt-dlp 的外部 JS runtime**（2025.11 起完整 YouTube 支持必需）。运维心智从「版本固定保稳定」反转为「**提取器类依赖跟随上游滚动更新**」——youtubei.js 与 yt-dlp 都是追着 YouTube 跑的库，落后即失效。
- **CSP 变更**（blocker 级）：现有全局安全头会封死 YouTube iframe。`buildContentSecurityPolicy` 调整：`frame-src` 加 `https://www.youtube.com https://www.youtube-nocookie.com`；`script-src` 加 `https://www.youtube.com`（iframe_api 与 www-widgetapi）。缩略图 `i.ytimg.com` 已被 `img-src https:` 覆盖。嵌入 host 用 `youtube-nocookie.com`（隐私增强模式）。
- 本地开发：`brew install yt-dlp`；启动探测二进制，缺失时 `/transcribe` 返回 `EXTRACTOR_UNAVAILABLE`；README 补依赖说明
- 容器 `/tmp`：评估挂 tmpfs 并设 size 上限，与并发信号量一起约束磁盘风险
- 无新环境变量（继续只用 `GROQ_API_KEY`）

### 4.5 客户端编排：导入 + 分片翻译

**职责划分**（审查修正：消除「弹窗等待 vs 跳页」矛盾）——弹窗只管 resolve+写库，**字幕链路由播放页自驱动**（类比现有 usePlayerDataQuery 的 auto-trigger 契约）：

```
MediaImportDialog:
  idle → resolving（/resolve）→ saving（写 media 表）→ 跳 /watch/$mediaId

/watch/$mediaId 挂载时自检（useSubtitlePipeline）:
  无 subtitle           → fetching-captions（/captions）
                            ├─ 成功         → chunked-translating → done
                            └─ NO_CAPTIONS  → transcribing（/youtube/transcribe）→ chunked-translating → done
  subtitle.status === 'failed' 或 processing 卡死超时 → 显示错误 + 一键重试
```

中途关弹窗/离开页面：链路状态全部落库（subtitles.status / postProcessStatus），重进 watch 页按当前状态续跑——「中途关弹窗后重进可恢复」列入 DoD。

**分片翻译编排器**（新增工作，审查修正：服务端 `/api/postprocess` 硬拒 >100 段 / >1 万字符 / 单段 >2000 字符，且为单请求一次性返回）：

- 按 ≤100 段且 ≤1 万字符切片，**串行**逐片 POST `/api/postprocess`（串行天然满足其 20 次/分钟限流；1000 段视频 ≈ 10 片）
- 每片返回立即写 segments 并 invalidate 查询 → 翻译列逐片上屏
- 片间失败：记录断点（已完成片数落在 postProcessStatus 语义内），重试从断点续

**官方字幕的 postprocess 策略**（审查修正：防 LLM「归一化」改写官方原文）：`source === 'official'` 时只取返回的 `translation` 写库，丢弃 normalizedText/annotations（furigana 仅日语内容按需），SubtitlePanel 对 official 字幕**永远显示原始 `text`**。

**语言轴接线**（审查修正：此前未定义）：

- `/captions` 的 `preferredLanguage` 不传，按 4.1② 优先级选**原声轨**（学习材料要原文）
- 翻译 `targetLanguage` = 用户母语/UI 语言（沿用现有 I18nContext → postprocess 链路），写入 `subtitles.targetLanguage`
- `sourceLanguage === targetLanguage` 时跳过翻译（targetLanguage 置 null）
- 用户事后改母语设置：已有字幕不自动重翻，靠「重新生成字幕」按钮

查询键按 transcriptionKeys 工厂模式新增 `mediaKeys` / `subtitleKeys`。

---

## Section 5：播放器适配层

目标：播放页、字幕同步、句级导航、键盘控制只依赖一个接口，不感知 `<audio>` vs YouTube IFrame。

### 5.1 `MediaSourceAdapter` 接口

```ts
interface MediaSourceAdapter {
  mount(container: HTMLElement): Promise<void>
  destroy(): void
  play(): Promise<void>
  pause(): void
  seekTo(seconds: number): void
  setPlaybackRate(rate: number): void
  getAvailablePlaybackRates(): number[]   // audio: 固定档；youtube: 透传 API，按视频而异
  setVolume(volume: number): void         // 0-1
  getCurrentTime(): number
  getDuration(): number
  on(event: AdapterEvent, cb: (payload?: unknown) => void): () => void
  // AdapterEvent = 'ready' | 'play' | 'pause' | 'ended' | 'timeupdate' | 'error'
}
```

- `timeupdate` 由 adapter 统一发出，~4Hz（250ms）。`<audio>` 原生即约 4Hz；YouTube 无 timeupdate 事件，playing 状态下 250ms `setInterval` 轮询 `getCurrentTime()` 模拟，暂停停轮询
- 倍速档位**不假设固定集合**：ready 后读 `getAvailablePlaybackRates()`，倍速控件据此过滤档位（审查修正：YouTube 可用倍速按视频而异）

### 5.2 两个实现

**`AudioFileAdapter`**（行为零变化，但**抽取来源修正**）：

- 逻辑来源是 **PlayerPage.tsx 的 audioRef effect 集群**（含 currentTime 回写防反馈循环的易碎逻辑）+ **usePlayerDataQuery 的 objectURL 管理**——不是三个 audio hooks（它们不直接操作 `<audio>`）
- objectURL 创建/撤销迁入 adapter 后，**usePlayerDataQuery 同步删除该职责**，避免双方各持一份 WeakMap
- 事件转发原生 play/pause/ended/timeupdate/error

**`YouTubeAdapter`**：

- mount：① 懒加载 iframe_api 脚本（模块级单例 Promise，处理 `onYouTubeIframeAPIReady` 竞态）② `new YT.Player(container, { videoId, host: 'https://www.youtube-nocookie.com', playerVars: { controls: 0, rel: 0, playsinline: 1 } })`——`modestbranding` 已废弃，不写 ③ onReady → resolve + 发 ready
- 状态映射：PLAYING→play、PAUSED→pause、ENDED→ended；BUFFERING 不外发
- onError 101/150（禁止嵌入）→ `EMBED_BLOCKED`，播放页兜底「该视频不允许嵌入，点此在 YouTube 打开」
- destroy：清轮询 + `player.destroy()`

自动播放：两种媒体统一不自动播放（绕开浏览器策略，也符合学习场景）。

### 5.3 Hook 层重组

```
usePlayerAdapter(media)
  ├─ 按 media.kind 创建 adapter（工厂 lib/media/adapters.ts）
  ├─ useEffect 管 mount/destroy
  └─ 暴露 { isReady, isPlaying, currentTime, duration, availableRates,
            play, pause, seekTo, setRate, setVolume }
```

其上两个媒体无关纯逻辑 hook（只消费 currentTime + segments + seekTo）：

- `useSegmentNavigation` → `{ activeIndex, goPrev, goNext }`。activeIndex **复用 [active-segment.ts](../../../src/lib/player/active-segment.ts) 的 `findActiveSegmentIndex`**（带段间空隙就近归属，对 ASR 字幕间隙尤其合适）；ScrollableSubtitleDisplay 的私有二分副本下沉到该模块统一
- `useSegmentLoop` → 单句循环：timeupdate 检测 `currentTime >= segment.end` → `seekTo(segment.start)`。4Hz 下 YouTube 最多越界 ~250ms，可接受

**死代码处置**（审查发现的既有问题，本期顺手清理）：`subtitle-sync.ts`（线性查找、零生产引用）删除或标注废弃；`AudioPlayer.tsx`（零引用）删除；`useKeyboardControls` 接入（见 3.3）。

### 5.4 YouTube 时间轴风险

| 风险 | 处理 |
|---|---|
| **广告**（审查修正：2024-08 后无登录 iframe 的 pre-roll 是常态，不是「频率低」） | tick 异常检测兜底：currentTime 突然回到 0-30s 且无用户 seek、或 getDuration() 突变 → 暂停字幕高亮与循环（显示「广告中」提示），时间回到预期窗口后恢复。spike/实施期实测广告期 getCurrentTime 实际表现后细化 |
| 用户在 iframe 内直接点击 | controls:0 后仍可点击播放/暂停；靠 onStateChange 同步，UI 被动跟随 |
| seek 后 BUFFERING 时间短暂回跳 | timeupdate 消费方均为无状态纯函数计算，回跳只闪一下高亮，无累积错误 |

### 5.5 适配层测试

- AudioFileAdapter：happy-dom 的 HTMLAudioElement，断言事件转发与 objectURL 撤销
- YouTubeAdapter：mock 全局 YT.Player，测脚本单例加载、状态映射、轮询启停（fake timers）、错误码映射、availableRates 透传
- useSegmentNavigation / useSegmentLoop：纯逻辑新测试（**不存在可改写的现成句级导航/倍速测试**），给定 segments + 模拟 currentTime 序列断言——回归价值最高

---

## Section 6：测试策略、验收标准与发布

### 6.1 测试矩阵

> 审查修正：仓库实际测试运行器是 **Vitest**（package.json `test: vitest` + vitest.config.ts + src/__tests__/setup.ts），不存在 bunfig.toml；`bun test` 不读 vitest 配置、实测必败。CLAUDE.md 的「Bun test」章节是过期文档（列入 6.4 纠错）。

运行命令：全量 `bun run test:run`（= vitest run）；单文件 `bunx vitest run path`。新测试沿用 vitest.config.ts 的 setupFiles 机制（happy-dom + fake-indexeddb）。

| 层 | 测试内容 |
|---|---|
| Dexie v4 迁移 | v3 schema 灌 files/transcripts/segments → v4 打开 → 断言 media/subtitles 行数与 id 保留、segments 未动、**旧表仍在且数据完整**；空库直接开 v4；externalId 唯一约束冲突路径 |
| DBUtils | addMedia/deleteMedia（children-first）/findMediaByExternalId；收编后的原直连调用点行为不变 |
| URL 解析 | 4 种形态 + 脏输入（playlist、非 YouTube 域、带 &t=、注入字符）表驱动 |
| 字幕归一化 | 毫秒→秒、碎片合并、空轨、单段；真实 ASR 响应 fixture |
| 轨道选择 | 5 级优先级 + 两步映射（元数据决策 → display name） |
| API handlers | mock youtubei.js/execFile/Groq，断言信封、全部错误码、限流/信号量/每日配额 |
| 分片翻译编排器 | 切片边界（100 段/1 万字符/单段 2000 字符）、串行节奏、断点续传、official 只写 translation |
| 适配层 + 导航/循环 hooks | 见 5.5 |
| 导入与字幕管线 | MediaImportDialog 状态机；useSubtitlePipeline 各分支（captions 成功 / NO_CAPTIONS 转写 / failed 重试 / 中断恢复） |

不自动化：真实 YouTube 网络调用（InnerTube 响应 fixture 快照 + 手动验收兜底）、IFrame 真实嵌入（YT.Player 全 mock）、广告行为（实机观察）。

### 6.2 迁移发布安全

两阶段方案（Section 2）本身就是安全机制：

1. **v4 不删旧表**——真正的恢复窗口。迁移 bug 时旧数据完好，hotfix 重放迁移即可
2. v4 打开后应用层行数比对（检测线，非防线），不一致即上报
3. 观察一个发布周期，v5 才删表
4. 迁移代码不吞错，失败整体回滚 v3（versionchange 事务原子性）
5. 预发验证：本地用真实使用过的浏览器 profile 跑迁移 + `docker compose up --build` 冒烟

### 6.3 手动验收清单（DoD）

**Spike（前置）**
- [ ] VPS 上 youtubei.js 与 yt-dlp 可达性 ≥90%（或已按对策阶梯调整方案）

**导入链路**
- [ ] 手动字幕视频：弹窗显示封面/标题/时长 → 跳播放页 → 字幕完整、翻译逐片补全
- [ ] 仅 ASR 字幕：合并后不碎、可逐句学习；显示官方原文（无 LLM 改写痕迹）
- [ ] 无字幕短视频：自动 Whisper，字幕栏显示阶段进度，完成后字幕出现
- [ ] 重复粘贴同一视频：跳已有记录，无重复行（含两标签页并发导入）
- [ ] 私享/直播/35 分钟无字幕/非法 URL/配额耗尽：各自明确 toast，弹窗不卡死
- [ ] 导入中途关弹窗 → 重进 watch 页：链路按落库状态续跑
- [ ] 「重新生成字幕」：official 免费重抓重翻；whisper 弹确认、重转写

**播放页**
- [ ] 三区布局；窄屏纵向堆叠；不存在的 mediaId 显示兜底页
- [ ] 当前句高亮 + 自动滚动居中 + 大字双语同步；点击字幕行跳转
- [ ] 上一句/下一句、单句循环（YouTube 误差 ≤250ms 可接受）、倍速（档位随视频）、音量
- [ ] 键盘控制可用（空格/←→ 等按 useKeyboardControls 规格）
- [ ] iframe 内直接点暂停 → 控制条跟随；禁止嵌入视频 → 「在 YouTube 打开」兜底
- [ ] 广告播出时字幕同步暂停、结束后恢复（实机观察）

**回归**
- [ ] 存量音频迁移后：列表可见、可播、字幕/翻译/furigana 完整；旧表数据仍在
- [ ] 上传新音频 → 转写 → 播放照常（入口在导入弹窗 Tab）
- [ ] `/player/$fileId` 重定向 `/watch/$mediaId`
- [ ] 双标签页打开：versionchange 提示刷新，无静默卡死
- [ ] 四主题 ThemeDebugger 核对；**无 CSP console 违规**；4 语言无缺 key
- [ ] `bun run lint` / `bun run type-check` / `bun run test:run` 全绿
- [ ] 已安装 PWA：在线更新后离线重开为新版本

### 6.4 发布步骤

1. PR 合入，走现有 review 流程
2. **bump service worker `CACHE_NAME`**（触发 SW 更新、activate 清旧缓存——否则离线 PWA 用户用旧壳打开 v4 库且刷新无效）；确认 `/watch/$mediaId` 与重定向在 SW 导航分支下正常
3. Dockerfile（yt-dlp 二进制 + Bun JS runtime + CSP 改动）后本地 `docker compose up --build` 冒烟：`/api/health` + 导入真实视频
4. Dokploy 部署 → 线上过导入链路前 3 条 + CSP 无违规
5. 文档同步：CLAUDE.md（新数据流/新 API/yt-dlp 依赖 + **纠正过期的「Bun test」测试章节**）、ARCHITECTURE.md（修过期的 Next.js 16 描述）、README（本地 yt-dlp 依赖）、部署文档（Traefik 清洗 x-forwarded-for 前置条件）
6. 下个发布周期：Dexie v5 删 files/transcripts 旧表

---

## 附：审查记录

本设计经 5 视角并行审查（代码库一致性 / Dexie 迁移 / YouTube 接入可行性 / 跨段一致性 / 测试发布安全）+ 逐发现对抗验证：45 条原始发现，42 条确认（2 blocker / 22 major / 18 minor）全部吸收，3 条被反驳剔除。关键修订：新增 Section 0 spike 决策门、CSP 变更、两阶段迁移、客户端分片翻译编排、yt-dlp 低码率与官方二进制方案、语言轴接线、official 字幕防改写策略、Vitest 测试口径。
