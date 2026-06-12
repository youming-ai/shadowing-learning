# 资料库「两条线」重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把单一资料库拆成两个顶级页面 —— `/`（在线发现：YouTube）和 `/me`（我的音频：上传），数据模型/适配器/播放管线全部复用，分界线只落在导航/UI 层。

**Architecture:** 抽一个纯展示的 `MediaLibraryGrid`（网格+搜索+空态插槽），两个页面各自喂按 `kind` 过滤的数据与各自的添加流；`MediaImportDialog` 拆成 `YouTubeImportDialog` + `AudioUploadDialog` 两个聚焦壳（复用现有 `useMediaImport` / `useFiles.addFiles`）；`useFiles` 加可选 `kind` 过滤。零后端、零数据模型改动。

**Tech Stack:** Bun + Vite + TanStack Start/Router/Query + React 19 + Dexie + Tailwind v4 + Vitest（**测试一律 `bun run test:run` / `bunx vitest run <path>`，绝不用 `bun test`**）。

**约定（所有任务）：** 包管理只用 `bun`。lint：`bun run lint`（Biome，0 error；写完新文件先 `bunx @biomejs/biome check --write <file>` 修 import 顺序/格式再提交）。类型：`bun run type-check`。i18n 翻译 hook 是 `useI18n`（返回 `{ t, currentLanguage, ... }`），`t(key: keyof TranslationKey, params?)`。规格源：[docs/superpowers/specs/2026-06-12-two-line-library-split-design.md](../specs/2026-06-12-two-line-library-split-design.md)。分支 `feat/shadowing`，每任务结束 commit。

---

## 文件地图

```
新建：
  src/components/features/library/MediaLibraryGrid.tsx (+__tests__)
  src/components/features/library/YouTubeImportDialog.tsx
  src/components/features/library/AudioUploadDialog.tsx
  src/components/features/library/OnlineLibraryPage.tsx
  src/components/features/library/MyAudioPage.tsx
  src/routes/me.tsx
修改：
  src/hooks/db/useFiles.ts          # +可选 kind 过滤
  src/hooks/db/__tests__/useFiles.test.tsx  # +kind 过滤用例
  src/lib/i18n/translations.ts      # +新 key×4 locale
  src/routes/index.tsx              # 渲染 OnlineLibraryPage
  src/components/ui/Navigation.tsx  # +/me 入口、online label、isActive 收紧
  src/lib/config/routes.ts          # +ONLINE/MY_AUDIO，清理 PLAYER
  src/routeTree.gen.ts              # vite build 再生成
删除（Task 9，确认无引用后）：
  src/components/features/library/LibraryPage.tsx
  src/components/features/library/MediaImportDialog.tsx
```

执行顺序：1（数据）→ 2（i18n）→ 3（grid）→ 4（两对话框）→ 5/6（两页）→ 7（路由）→ 8（导航）→ 9（清理）。

---

### Task 1: useFiles 增加 kind 过滤

**Files:**
- Modify: `src/hooks/db/useFiles.ts`
- Test: `src/hooks/db/__tests__/useFiles.test.tsx`

- [ ] **Step 1: 写失败测试**（追加到现有 describe 内；现有测试结构用 QueryClientProvider wrapper + fake-indexeddb）

```tsx
// 追加到 src/hooks/db/__tests__/useFiles.test.tsx 的 describe('useFiles', ...) 内
it('filters media by kind when a kind arg is passed', async () => {
  await DBUtils.addMedia({
    kind: 'youtube', title: 'yt', durationSec: 10,
    addedAt: new Date('2026-01-02'), updatedAt: new Date('2026-01-02'),
    externalId: 'dQw4w9WgXcQ',
  })
  await DBUtils.addMedia({
    kind: 'audio', title: 'a.mp3', durationSec: null,
    addedAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    blob: new Blob(['x']), fileName: 'a.mp3', fileSize: 1, mimeType: 'audio/mpeg',
  })

  const { result: online } = renderHook(() => useFiles('youtube'), { wrapper })
  await waitFor(() => expect(online.current.files).toHaveLength(1))
  expect(online.current.files[0].kind).toBe('youtube')

  const { result: mine } = renderHook(() => useFiles('audio'), { wrapper })
  await waitFor(() => expect(mine.current.files).toHaveLength(1))
  expect(mine.current.files[0].kind).toBe('audio')

  const { result: all } = renderHook(() => useFiles(), { wrapper })
  await waitFor(() => expect(all.current.files).toHaveLength(2))
})
```

If the test file lacks `DBUtils`/`renderHook`/`waitFor`/`wrapper` imports, add them following the file's existing pattern (it already uses `@testing-library/react` + a `QueryClientProvider` wrapper; import `DBUtils` from `~/lib/db/db`). Clear the media table in a `beforeEach`/`afterEach` (`await db.media.clear()`).

- [ ] **Step 2: 跑测试确认失败**

Run: `bunx vitest run src/hooks/db/__tests__/useFiles.test.tsx`
Expected: FAIL — `useFiles('youtube')` still returns all rows (kind arg ignored).

- [ ] **Step 3: 实现** — 在 `useFiles.ts` 给函数加可选参数并在查询层过滤：

```ts
export function useFiles(kind?: MediaRow['kind']): UseFilesReturn {
  const queryClient = useQueryClient()

  const {
    data: files = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: filesKeys.all,
    queryFn: async () => {
      return await DBUtils.listMedia()
    },
    select: (rows) => (kind ? rows.filter((m) => m.kind === kind) : rows),
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
  })
  // ...rest unchanged
```

`select` 在共享 `filesKeys.all` 缓存上做派生过滤——两页共享同一份底层查询、各自得到过滤视图，导入/上传后 `invalidateQueries({ queryKey: filesKeys.all })` 同时刷新两页。函数签名其余（`addFiles`/`deleteFile`/返回结构）不变。

- [ ] **Step 4: 跑测试确认通过**

Run: `bunx vitest run src/hooks/db/__tests__/useFiles.test.tsx && bun run type-check`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
bunx @biomejs/biome check --write src/hooks/db/useFiles.ts src/hooks/db/__tests__/useFiles.test.tsx
git add src/hooks/db/useFiles.ts src/hooks/db/__tests__/useFiles.test.tsx
git commit -m "feat(library): useFiles optional kind filter via query select"
```

---

### Task 2: i18n 文案（4 locale）

**Files:**
- Modify: `src/lib/i18n/translations.ts`

- [ ] **Step 1: 在 `TranslationKey` 接口的 `// Common` 之前追加 key**

```ts
  // Two-line nav + pages
  'nav.online': string
  'nav.myAudio': string
  'online.title': string
  'online.empty.title': string
  'online.empty.cta': string
  'online.tab.youtube': string
  'online.tab.podcast': string
  'online.tab.podcastSoon': string
  'myaudio.title': string
  'myaudio.empty.title': string
  'myaudio.empty.cta': string
  'myaudio.upload': string
```

- [ ] **Step 2: 四个 locale 各补全这 12 个 key**（每个 locale 对象内插入；type-check 是完备性兜底）

zh-CN:
```ts
  'nav.online': '在线',
  'nav.myAudio': '我的音频',
  'online.title': '在线发现',
  'online.empty.title': '还没有在线内容',
  'online.empty.cta': '粘贴一个 YouTube 链接开始学习',
  'online.tab.youtube': 'YouTube',
  'online.tab.podcast': '播客',
  'online.tab.podcastSoon': '即将推出',
  'myaudio.title': '我的音频',
  'myaudio.empty.title': '还没有上传音频',
  'myaudio.empty.cta': '上传一段音频开始练习',
  'myaudio.upload': '上传音频',
```

en-US:
```ts
  'nav.online': 'Online',
  'nav.myAudio': 'My Audio',
  'online.title': 'Discover',
  'online.empty.title': 'No online content yet',
  'online.empty.cta': 'Paste a YouTube link to start learning',
  'online.tab.youtube': 'YouTube',
  'online.tab.podcast': 'Podcast',
  'online.tab.podcastSoon': 'Coming soon',
  'myaudio.title': 'My Audio',
  'myaudio.empty.title': 'No uploaded audio yet',
  'myaudio.empty.cta': 'Upload an audio file to start practicing',
  'myaudio.upload': 'Upload audio',
```

zh-TW:
```ts
  'nav.online': '線上',
  'nav.myAudio': '我的音訊',
  'online.title': '線上探索',
  'online.empty.title': '還沒有線上內容',
  'online.empty.cta': '貼上一個 YouTube 連結開始學習',
  'online.tab.youtube': 'YouTube',
  'online.tab.podcast': '播客',
  'online.tab.podcastSoon': '即將推出',
  'myaudio.title': '我的音訊',
  'myaudio.empty.title': '還沒有上傳音訊',
  'myaudio.empty.cta': '上傳一段音訊開始練習',
  'myaudio.upload': '上傳音訊',
```

ja-JP:
```ts
  'nav.online': 'オンライン',
  'nav.myAudio': 'マイ音声',
  'online.title': '見つける',
  'online.empty.title': 'オンラインコンテンツがまだありません',
  'online.empty.cta': 'YouTube リンクを貼り付けて学習を始める',
  'online.tab.youtube': 'YouTube',
  'online.tab.podcast': 'ポッドキャスト',
  'online.tab.podcastSoon': '近日公開',
  'myaudio.title': 'マイ音声',
  'myaudio.empty.title': 'アップロードした音声がまだありません',
  'myaudio.empty.cta': '音声をアップロードして練習を始める',
  'myaudio.upload': '音声をアップロード',
```

- [ ] **Step 3: 验证 + Commit**

Run: `bun run type-check`（缺任一 locale 的 key 会在此失败）→ PASS

```bash
bunx @biomejs/biome check --write src/lib/i18n/translations.ts
git add src/lib/i18n/translations.ts
git commit -m "feat(i18n): online/my-audio nav + page strings in 4 locales"
```

---

### Task 3: MediaLibraryGrid 共享展示组件

**Files:**
- Create: `src/components/features/library/MediaLibraryGrid.tsx`
- Test: `src/components/features/library/__tests__/MediaLibraryGrid.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
// src/components/features/library/__tests__/MediaLibraryGrid.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MediaLibraryGrid } from '~/components/features/library/MediaLibraryGrid'
import type { MediaRow } from '~/types/db/database'

const media: MediaRow[] = [
  { id: 1, kind: 'youtube', title: 'WWDC recap', channelName: 'MKBHD', durationSec: 90,
    addedAt: new Date(), updatedAt: new Date(), externalId: 'aaaaaaaaaaa', thumbnailUrl: '' },
  { id: 2, kind: 'youtube', title: 'Cooking show', channelName: 'Chef', durationSec: 120,
    addedAt: new Date(), updatedAt: new Date(), externalId: 'bbbbbbbbbbb', thumbnailUrl: '' },
]

describe('MediaLibraryGrid', () => {
  it('renders a card per media item', () => {
    render(
      <MediaLibraryGrid media={media} title="Discover" searchPlaceholder="search"
        addSlot={<button type="button">add</button>} emptyState={<div>empty</div>}
        onDelete={vi.fn()} />,
    )
    expect(screen.getByText('WWDC recap')).toBeInTheDocument()
    expect(screen.getByText('Cooking show')).toBeInTheDocument()
  })

  it('filters by search over title/channel', async () => {
    render(
      <MediaLibraryGrid media={media} title="Discover" searchPlaceholder="search"
        addSlot={<button type="button">add</button>} emptyState={<div>empty</div>}
        onDelete={vi.fn()} />,
    )
    await userEvent.type(screen.getByPlaceholderText('search'), 'cooking')
    expect(screen.queryByText('WWDC recap')).not.toBeInTheDocument()
    expect(screen.getByText('Cooking show')).toBeInTheDocument()
  })

  it('shows the empty state when there is no media', () => {
    render(
      <MediaLibraryGrid media={[]} title="Discover" searchPlaceholder="search"
        addSlot={<button type="button">add</button>} emptyState={<div>nothing here</div>}
        onDelete={vi.fn()} />,
    )
    expect(screen.getByText('nothing here')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2:** Run: `bunx vitest run src/components/features/library/__tests__/MediaLibraryGrid.test.tsx` → FAIL（模块不存在）

- [ ] **Step 3: 实现**（把现有 `LibraryPage` 的网格/搜索骨架迁入；标题/搜索框/添加槽/空态都参数化）

```tsx
// src/components/features/library/MediaLibraryGrid.tsx
import { type ReactNode, useMemo, useState } from 'react'
import { MediaCard } from '~/components/features/library/MediaCard'
import { Input } from '~/components/ui/input'
import type { MediaRow } from '~/types/db/database'

interface MediaLibraryGridProps {
  media: MediaRow[]
  title: string
  searchPlaceholder: string
  addSlot: ReactNode
  emptyState: ReactNode
  onDelete: (id: number) => void
}

export function MediaLibraryGrid({
  media,
  title,
  searchPlaceholder,
  addSlot,
  emptyState,
  onDelete,
}: MediaLibraryGridProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return media
    return media.filter(
      (m) => m.title.toLowerCase().includes(q) || (m.channelName ?? '').toLowerCase().includes(q),
    )
  }, [media, search])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
        <div className="flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-56"
          />
          {addSlot}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--border-primary)] py-20">
          {emptyState}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <MediaCard key={m.id} media={m} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4:** Run: `bunx vitest run src/components/features/library/__tests__/MediaLibraryGrid.test.tsx && bun run type-check` → PASS

- [ ] **Step 5: Commit**

```bash
bunx @biomejs/biome check --write src/components/features/library/MediaLibraryGrid.tsx src/components/features/library/__tests__/MediaLibraryGrid.test.tsx
git add src/components/features/library/MediaLibraryGrid.tsx src/components/features/library/__tests__/MediaLibraryGrid.test.tsx
git commit -m "feat(library): shared MediaLibraryGrid (grid + search + empty/add slots)"
```

---

### Task 4: 拆分导入对话框（YouTube / 上传）

**Files:**
- Create: `src/components/features/library/YouTubeImportDialog.tsx`
- Create: `src/components/features/library/AudioUploadDialog.tsx`

> 这两个壳的内容直接来自现有 `MediaImportDialog.tsx` 的两个 tab，逻辑（`useMediaImport` / `useFiles.addFiles` / `FileUpload`）原样复用，只是各自独立、不再互露对方 tab。无新单测（纯组合，由后续页面渲染 + 现有 useMediaImport 测试覆盖）。

- [ ] **Step 1: YouTubeImportDialog**

```tsx
// src/components/features/library/YouTubeImportDialog.tsx
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { ImportError, useMediaImport } from '~/hooks/media/useMediaImport'
import { youtubeErrorMessageKey } from '~/lib/youtube/error-messages'

interface YouTubeImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function YouTubeImportDialog({ open, onOpenChange }: YouTubeImportDialogProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const { stage, importYouTubeUrl } = useMediaImport()
  const busy = stage !== 'idle'

  const handleImport = async () => {
    if (!url.trim() || busy) return
    try {
      const mediaId = await importYouTubeUrl(url.trim())
      onOpenChange(false)
      setUrl('')
      navigate({ to: '/watch/$mediaId', params: { mediaId: String(mediaId) } })
    } catch (error) {
      const code = error instanceof ImportError ? error.code : undefined
      toast.error(t(youtubeErrorMessageKey(code)))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('import.tab.youtube')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('import.url.placeholder')}
            onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            disabled={busy}
          />
          <Button onClick={handleImport} disabled={busy || !url.trim()}>
            {stage === 'resolving'
              ? t('import.resolving')
              : stage === 'saving'
                ? t('import.saving')
                : t('import.submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: AudioUploadDialog**

```tsx
// src/components/features/library/AudioUploadDialog.tsx
import { useState } from 'react'
import FileUpload from '~/components/features/file/FileUpload'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { useFiles } from '~/hooks/db/useFiles'

interface AudioUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AudioUploadDialog({ open, onOpenChange }: AudioUploadDialogProps) {
  const { t } = useI18n()
  const { addFiles, files } = useFiles()
  const [uploading, setUploading] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('myaudio.upload')}</DialogTitle>
        </DialogHeader>
        <div className="pt-2">
          <FileUpload
            onFilesSelected={async (selected) => {
              setUploading(true)
              try {
                await addFiles(selected)
                onOpenChange(false)
              } finally {
                setUploading(false)
              }
            }}
            isUploading={uploading}
            currentFileCount={files.length}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: 验证 + Commit**

Run: `bunx @biomejs/biome check --write src/components/features/library/YouTubeImportDialog.tsx src/components/features/library/AudioUploadDialog.tsx && bun run type-check` → PASS

```bash
git add src/components/features/library/YouTubeImportDialog.tsx src/components/features/library/AudioUploadDialog.tsx
git commit -m "feat(library): split import dialog into focused YouTube/upload dialogs"
```

---

### Task 5: OnlineLibraryPage（在线发现，YouTube）

**Files:**
- Create: `src/components/features/library/OnlineLibraryPage.tsx`

- [ ] **Step 1: 实现**（grid + YouTube 添加 + 播客 disabled 子 tab）

```tsx
// src/components/features/library/OnlineLibraryPage.tsx
import { useState } from 'react'
import { MediaLibraryGrid } from '~/components/features/library/MediaLibraryGrid'
import { YouTubeImportDialog } from '~/components/features/library/YouTubeImportDialog'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { Button } from '~/components/ui/button'
import { PageLoadingState } from '~/components/ui/LoadingState'
import { useFiles } from '~/hooks/db/useFiles'

export function OnlineLibraryPage() {
  const { t } = useI18n()
  const { files: media, isLoading, deleteFile } = useFiles('youtube')
  const [importOpen, setImportOpen] = useState(false)

  if (isLoading) return <PageLoadingState />

  return (
    <div className="flex flex-col gap-4">
      {/* 内容源子 tab：YouTube 激活，播客预留 disabled */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-sm font-medium text-[var(--color-primary)]">
          {t('online.tab.youtube')}
        </span>
        <span
          className="cursor-not-allowed rounded-full px-3 py-1 text-sm text-[var(--text-tertiary)]"
          title={t('online.tab.podcastSoon')}
        >
          {t('online.tab.podcast')}
          <span className="ml-1 text-xs">· {t('online.tab.podcastSoon')}</span>
        </span>
      </div>

      <MediaLibraryGrid
        media={media}
        title={t('online.title')}
        searchPlaceholder={t('library.search.placeholder')}
        onDelete={(id) => void deleteFile(String(id))}
        addSlot={
          <Button onClick={() => setImportOpen(true)}>
            <span className="material-symbols-outlined mr-1 text-base">add</span>
            {t('library.add')}
          </Button>
        }
        emptyState={
          <>
            <p className="text-base font-medium text-[var(--text-primary)]">
              {t('online.empty.title')}
            </p>
            <Button onClick={() => setImportOpen(true)}>{t('online.empty.cta')}</Button>
          </>
        }
      />

      <YouTubeImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
```

- [ ] **Step 2: 验证 + Commit**

Run: `bunx @biomejs/biome check --write src/components/features/library/OnlineLibraryPage.tsx && bun run type-check` → PASS

```bash
git add src/components/features/library/OnlineLibraryPage.tsx
git commit -m "feat(library): OnlineLibraryPage (YouTube grid + import + podcast placeholder tab)"
```

---

### Task 6: MyAudioPage（我的音频，上传）

**Files:**
- Create: `src/components/features/library/MyAudioPage.tsx`

- [ ] **Step 1: 实现**

```tsx
// src/components/features/library/MyAudioPage.tsx
import { useState } from 'react'
import { AudioUploadDialog } from '~/components/features/library/AudioUploadDialog'
import { MediaLibraryGrid } from '~/components/features/library/MediaLibraryGrid'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { Button } from '~/components/ui/button'
import { PageLoadingState } from '~/components/ui/LoadingState'
import { useFiles } from '~/hooks/db/useFiles'

export function MyAudioPage() {
  const { t } = useI18n()
  const { files: media, isLoading, deleteFile } = useFiles('audio')
  const [uploadOpen, setUploadOpen] = useState(false)

  if (isLoading) return <PageLoadingState />

  return (
    <div className="flex flex-col gap-4">
      <MediaLibraryGrid
        media={media}
        title={t('myaudio.title')}
        searchPlaceholder={t('library.search.placeholder')}
        onDelete={(id) => void deleteFile(String(id))}
        addSlot={
          <Button onClick={() => setUploadOpen(true)}>
            <span className="material-symbols-outlined mr-1 text-base">upload</span>
            {t('myaudio.upload')}
          </Button>
        }
        emptyState={
          <>
            <p className="text-base font-medium text-[var(--text-primary)]">
              {t('myaudio.empty.title')}
            </p>
            <Button onClick={() => setUploadOpen(true)}>{t('myaudio.empty.cta')}</Button>
          </>
        }
      />

      <AudioUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  )
}
```

- [ ] **Step 2: 验证 + Commit**

Run: `bunx @biomejs/biome check --write src/components/features/library/MyAudioPage.tsx && bun run type-check` → PASS

```bash
git add src/components/features/library/MyAudioPage.tsx
git commit -m "feat(library): MyAudioPage (uploaded-audio grid + upload dialog)"
```

---

### Task 7: 路由接线（index → 在线，新增 /me）

**Files:**
- Modify: `src/routes/index.tsx`
- Create: `src/routes/me.tsx`
- Modify: `src/lib/config/routes.ts`
- Modify: `src/routeTree.gen.ts`（vite build 再生成）

- [ ] **Step 1: index.tsx 改渲染 OnlineLibraryPage**

```tsx
// src/routes/index.tsx — 整文件替换
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { OnlineLibraryPage } from '~/components/features/library/OnlineLibraryPage'
import { PageLoadingState } from '~/components/ui/LoadingState'
import Navigation from '~/components/ui/Navigation'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Navigation />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8 mt-24">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<PageLoadingState />}>
            <OnlineLibraryPage />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: 新建 me.tsx**

```tsx
// src/routes/me.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { MyAudioPage } from '~/components/features/library/MyAudioPage'
import { PageLoadingState } from '~/components/ui/LoadingState'
import Navigation from '~/components/ui/Navigation'

export const Route = createFileRoute('/me')({
  component: MyAudioRoute,
})

function MyAudioRoute() {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Navigation />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8 mt-24">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<PageLoadingState />}>
            <MyAudioPage />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: routes.ts — 加 ONLINE/MY_AUDIO，清理 PLAYER**

`src/lib/config/routes.ts`：`ROUTES` 加 `ONLINE: '/'`、`MY_AUDIO: '/me'`（保留 `HOME: '/'` 以防别处引用，或把 HOME 语义即作 ONLINE——二选一，保留 `HOME` 更安全）。删除 `PLAYER: '/player/[fileId]'` 及 `generatePath` 里的 player 特判和 `getPlayerRoute`——**先 grep 确认无引用**：

```bash
grep -rn "ROUTES.PLAYER\|getPlayerRoute\|generatePath" src --include='*.ts' --include='*.tsx' | grep -v routes.ts
```
若有命中（很可能已无，旧 player 页在上个项目已删），改用 `/watch` 或一并清理；无命中则安全删除。

- [ ] **Step 4: 再生成路由树 + 验证**

Run: `bunx vite build`（再生成 `src/routeTree.gen.ts`，加入 `/me`）→ 然后 `bun run type-check`
Expected: PASS（`/me` 的 `createFileRoute('/me')` 类型在 build 后可用）。访问 `bun run dev` → `/` 见在线页、`/me` 见音频页。

- [ ] **Step 5: Commit**

```bash
bunx @biomejs/biome check --write src/routes/index.tsx src/routes/me.tsx src/lib/config/routes.ts
git add src/routes/index.tsx src/routes/me.tsx src/lib/config/routes.ts src/routeTree.gen.ts
git commit -m "feat(routes): / = online discover, /me = my audio; regenerate route tree"
```

---

### Task 8: Navigation 顶栏（在线 / 我的音频）

**Files:**
- Modify: `src/components/ui/Navigation.tsx`

- [ ] **Step 1: 改 navLinks + isActive**（home 入口 label 改 `nav.online`，新增 `/me`，收紧高亮逻辑）

```tsx
  const navLinks = [
    {
      id: 'online',
      labelKey: 'nav.online' as const,
      icon: 'explore',
      href: '/',
    },
    {
      id: 'myAudio',
      labelKey: 'nav.myAudio' as const,
      icon: 'library_music',
      href: '/me',
    },
    {
      id: 'settings',
      labelKey: 'nav.settings' as const,
      icon: 'settings',
      href: ROUTES.SETTINGS,
    },
    {
      id: 'account',
      labelKey: 'nav.account' as const,
      icon: 'account_circle',
      href: ROUTES.ACCOUNT,
    },
  ] as const
```

`isActive` 收紧（`/` 仅精确匹配，避免 `/me` 误命中 `/`；watch 页归属在线）：

```tsx
  const isActive =
    item.href === '/'
      ? pathname === '/' || pathname.startsWith('/watch') || pathname.startsWith('/player')
      : pathname === item.href || pathname.startsWith(`${item.href}/`)
```

（`nav.online`/`nav.myAudio` 已在 Task 2 加入 4 locale，`labelKey` 的 `as const` 类型可过。）

- [ ] **Step 2: 验证 + Commit**

Run: `bunx @biomejs/biome check --write src/components/ui/Navigation.tsx && bun run type-check && bun run lint` → PASS

```bash
git add src/components/ui/Navigation.tsx
git commit -m "feat(nav): top-bar entries for Online (/) and My Audio (/me)"
```

---

### Task 9: 清理旧资料库组件

**Files:**
- Delete: `src/components/features/library/LibraryPage.tsx`、`src/components/features/library/MediaImportDialog.tsx`

- [ ] **Step 1: grep 确认无引用**

```bash
grep -rn "LibraryPage\|MediaImportDialog" src --include='*.ts' --include='*.tsx' | grep -vE "OnlineLibraryPage|MyAudioPage" | grep -v "/LibraryPage.tsx" | grep -v "/MediaImportDialog.tsx"
```
Expected: 无命中（index.tsx 已改用 OnlineLibraryPage；两个新对话框取代了 MediaImportDialog）。若有命中，先改引用再删。

- [ ] **Step 2: 删除 + 全量验证**

```bash
git rm src/components/features/library/LibraryPage.tsx src/components/features/library/MediaImportDialog.tsx
bun run type-check && bun run lint && bun run test:run
```
Expected: type-check/lint 干净；测试全绿（无测试依赖被删文件——若有，更新或删除对应测试）。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(library): remove old unified LibraryPage + MediaImportDialog"
```

---

## 最终验收（DoD）

- [ ] `bun run lint && bun run type-check && bun run test:run` 全绿
- [ ] `bun run dev`：`/` 只见 YouTube 卡片 + YouTube 添加流 + 播客 disabled tab；`/me` 只见音频卡片 + 上传流；顶栏可切换且高亮正确；两页卡片都能进 `/watch/$mediaId` 正常播放
- [ ] 存量上传音频出现在 `/me`，存量/新导入 YouTube 出现在 `/`；删除、搜索、空态各页正确
- [ ] 四主题 ThemeDebugger 核对新页面 token；4 locale 切换文案无缺 key

## 与 spec 的已知偏离

- `ROUTES.HOME` 保留（不强行改名为 ONLINE），降低对潜在引用的波及——`ONLINE`/`MY_AUDIO` 作为新增常量并存。
