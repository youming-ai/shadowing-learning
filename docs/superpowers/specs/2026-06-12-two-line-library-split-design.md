# 资料库「两条线」重构 — 设计文档

- 日期：2026-06-12
- 状态：已与产品负责人对齐，待 spec 复核
- 前置：本重构建立在已完成的 YouTube 学习平台子项目 #1 之上（见 [2026-06-10-youtube-learning-platform-design.md](2026-06-10-youtube-learning-platform-design.md)）。

## 动机与边界（已确认）

- **动机 = 产品/UX 清晰**：「在线内容（YouTube，未来播客）」与「我的音频（用户上传）」是两个不同的用户心智，应该是两个不同的入口/区域。
- **分界线在导航/UI 层**：现有的统一 `media` 表（`kind: 'audio' | 'youtube'`）、`MediaSourceAdapter`（AudioFileAdapter / YouTubeAdapter）、`useSubtitlePipeline`、`/watch/$mediaId` 播放页**全部保留复用，零后端/数据模型改动**。
- **播客**：本期只在 UI 上预留插槽（在线页内 disabled 子 tab），**不实现**播客后端（RSS/抓取/转写）——留作独立子项目。
- **不做**：生词本/句子本/历史记录页、订阅频道、字幕设置面板、多翻译引擎 UI、数据模型拆分。这些仍属后续子项目。

## 采用方案

**方案 A — 共享网格组件 + 按 kind 过滤的两个页面**。抽一个纯展示的 `MediaLibraryGrid`（网格 + 搜索 + 空态插槽），两个路由各自喂过滤后的数据与各自的「添加」动作。改动锁在 UI/导航层，不重复网格/搜索逻辑（避免方案 B 的过早抽象、方案 C 的弱分离）。

---

## Section 1：路由与导航

| 路由 | 页面 | 内容 | 添加动作 |
|---|---|---|---|
| `/` | `OnlineLibraryPage` | 仅 `kind: 'youtube'` | 粘贴 YouTube 链接 |
| `/me` | `MyAudioPage` | 仅 `kind: 'audio'` | 上传音频 |
| `/watch/$mediaId` | 不变 | 两种 kind 共用 | — |
| `/player/$fileId` | 不变（重定向到 `/watch`） | — | — |

- 在线页内为播客预留一个 **disabled 子 tab**（「YouTube」激活 / 「播客」灰显 + 「即将推出」），不接任何逻辑。
- `Navigation` 顶栏：现有 `home`(/) 入口的 label key 改用新增的 `nav.online`（图标保持或改 `explore`/`public`，语义＝「在线发现」）；新增 `/me` 入口，图标 `library_music`，label key `nav.myAudio`。两个入口并列在 settings/account 之前。`isActive`：`/me` 精确匹配 `/me`；`/` 仅在 pathname 恰为 `/` 时高亮（不要让 `/me` 也命中 `/` 的 startsWith 逻辑——现有 isActive 对 `/player` 的特判要相应收紧）。
- `src/lib/config/routes.ts` 的 `ROUTES`：新增 `ONLINE: '/'`、`MY_AUDIO: '/me'`；保留 `SETTINGS`/`ACCOUNT`；清理过期的 `PLAYER: '/player/[fileId]'` 常量及其 `generatePath`/`getPlayerRoute`（确认无引用后删除，type-check 兜底）。
- 新增路由文件 `src/routes/me.tsx`（`createFileRoute('/me')`），渲染 `MyAudioPage`；`src/routes/index.tsx` 改渲染 `OnlineLibraryPage`。`routeTree.gen.ts` 由 `vite build` 再生成并提交。

## Section 2：组件拆分

- **新增 `src/components/features/library/MediaLibraryGrid.tsx`**（纯展示）：
  ```ts
  interface MediaLibraryGridProps {
    media: MediaRow[]
    searchPlaceholder: string
    title: string
    addSlot: React.ReactNode       // 页面各自的「添加」按钮
    emptyState: React.ReactNode    // 页面各自的空态（文案 + CTA）
    onDelete: (id: number) => void
  }
  ```
  内部持有 search state + useMemo 过滤（title/channelName 包含匹配），复用现有 `MediaCard`。把现有 `LibraryPage` 的网格/搜索/标题骨架迁入此组件。
- **`OnlineLibraryPage`**：`useFiles('youtube')` 取数据；`addSlot` = 「添加 YouTube」按钮 → 打开 YouTube 链接对话框；`emptyState` = 「粘贴 YouTube 链接开始学习」；顶部含 YouTube/播客 disabled 子 tab。
- **`MyAudioPage`**：`useFiles('audio')` 取数据；`addSlot` = 「上传音频」按钮 → 打开上传流程；`emptyState` = 「上传一段音频开始练习」。
- **拆分 `MediaImportDialog`** 为两个聚焦组件（符合「UX 清晰」，两页不再互露对方 tab）：
  - `YouTubeImportDialog`：URL 输入 + 导入态 stepper，复用现有 `useMediaImport`。
  - `AudioUploadDialog`（或直接内联 `FileUpload`）：复用现有 `FileUpload` + `useFiles().addFiles`。
  - 公共导入逻辑已在 hooks 里，两个对话框只是壳。
- **退役**：现有 `src/components/features/library/LibraryPage.tsx` 与 `MediaImportDialog.tsx` 拆分后删除（确认无其它引用）。

## Section 3：数据流

- `src/hooks/db/useFiles.ts` 增加可选 `kind` 过滤参数：`useFiles(kind?: 'audio' | 'youtube')`。实现上在 `queryFn`/`select` 里对 `listMedia()` 结果按 kind 过滤（客户端数据量小，无需新查询键；`filesKeys.all` 不变，两页共享缓存）。返回结构、`addFiles`、`deleteFile` 全部不变。
- 导入（YouTube resolve → 写 media → 跳 watch）、上传（addFiles 写 audio media）、删除（deleteMedia children-first）、跳转 watch、字幕管线——**全部复用现有逻辑，零改动**。
- `media.kind` 已是判别字段，过滤是纯读取层操作，不触碰 v4 schema、迁移、适配器、pipeline。

## Section 4：i18n 与测试

**i18n**（4 locale，沿用 `TranslationKey` 接口的类型完备性保证）：
- 新增 key：`nav.online`（「在线」）、`nav.myAudio`（「我的音频」）、`online.title`、`online.empty.title`、`online.empty.cta`、`online.tab.youtube`、`online.tab.podcast`、`online.tab.podcastSoon`、`myaudio.title`、`myaudio.empty.title`、`myaudio.empty.cta`、`myaudio.upload`。
- 复用现有 `import.*` / `library.*` 文案（如 `library.search.placeholder`、`library.deleteConfirm`、`import.tab.youtube` 等仍适用）。

**测试**（Vitest，`bun run test:run`）：
- `MediaLibraryGrid`：给定混合/同 kind 列表，断言搜索过滤、空态渲染、删除回调。
- `OnlineLibraryPage` / `MyAudioPage`：mock `useFiles`，断言各自只渲染对应 kind、添加按钮触发正确对话框。
- `useFiles(kind)`：断言按 kind 过滤正确（fake-indexeddb 灌两种 media，分别取）。
- 现有 watch / pipeline / adapter / db 测试**不改动**，应继续全绿。

## 验收（DoD）

- `bun run lint && bun run type-check && bun run test:run` 全绿。
- 手动：`/` 只见 YouTube 卡片 + YouTube 添加流；`/me` 只见音频卡片 + 上传流；顶栏可切换两页；播客子 tab 灰显不可点；两页卡片都能进 `/watch/$mediaId` 正常播放；存量上传音频出现在 `/me`、存量/新导入 YouTube 出现在 `/`；删除、搜索、空态各页正确。
- 四主题 ThemeDebugger 核对新页面 token；4 locale 无缺 key。

## 与现有代码的衔接点（实施者须知）

- `useFiles` 当前返回全部 media 且命名偏旧（保留名字，加 kind 过滤即可，避免大改名波及调用点）。
- `Navigation.tsx` 的 `navLinks` 数组 + `ROUTES` 是新增入口的落点；`isActive` 逻辑对 `/me` 需正确高亮。
- `MediaCard` 已同时支持 youtube（缩略图）与 audio（音符占位），两页直接复用。
- `routeTree.gen.ts` 勿手改，新增 `/me` 路由后用 `bunx vite build` 再生成并提交。
- 拆对话框时注意 `MediaImportDialog` 当前用默认 `import z from 'zod'`/`useI18n` 模式（沿用），导入成功后 `navigate({ to: '/watch/$mediaId' })`。
