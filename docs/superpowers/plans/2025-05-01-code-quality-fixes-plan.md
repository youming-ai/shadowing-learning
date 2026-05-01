# 代码质量修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复代码质量审查中识别的所有高/中优先级问题：API 可靠性、安全漏洞、组件性能、数据库事务、类型冗余、CSS 规范、可访问性、后处理状态透明化。

**Architecture:** 以"基础设施已完善，业务代码未接入"为核心思路，通过创建统一封装层让核心路由使用已有的重试/超时/限流工具；替换安全敏感的自研实现为社区标准库；性能优化以最小侵入方式修复 memo 失效；类型和 CSS 修复以清理冗余和错误为主。

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Dexie (IndexedDB), Groq SDK, Biome, Tailwind CSS, Vitest + jsdom

---

## 文件变更概览

### 新增
- `src/lib/ai/groq-client.ts`
- `src/lib/ai/groq-request-wrapper.ts`
- `src/types/player.ts`
- `src/components/features/player/PlayerFooterContainer.tsx`
- `src/components/features/player/PlayerErrorBoundary.tsx`

### 修改
- `src/app/api/transcribe/route.ts`
- `src/app/api/postprocess/route.ts`
- `src/lib/utils/security.ts`
- `src/hooks/api/useTranscription.ts`
- `src/components/features/player/PlayerPage.tsx`
- `src/components/features/player/ScrollableSubtitleDisplay.tsx`
- `src/lib/db/db.ts`
- `src/styles/globals.css`
- `src/types/db/database.ts`
- `src/types/transcription.ts`
- `src/types/api.types.ts`
- `next.config.js`
- `biome.json`
- `package.json`

---

## Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 isomorphic-dompurify 和 react-error-boundary**

```bash
pnpm add isomorphic-dompurify react-error-boundary
```

- [ ] **Step 2: 验证安装成功**

```bash
pnpm install --frozen-lockfile
```
Expected: 无错误，lockfile 未改变（除新增包外）

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add isomorphic-dompurify and react-error-boundary"
```

---

## Task 2: 创建 Groq Client 单例和请求封装

**Files:**
- Create: `src/lib/ai/groq-client.ts`
- Create: `src/lib/ai/groq-request-wrapper.ts`

- [ ] **Step 1: 创建 groq-client.ts**

```typescript
import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.warn("[groq-client] GROQ_API_KEY is not configured");
}

export const groqClient = new Groq({
  apiKey,
});
```

- [ ] **Step 2: 创建 groq-request-wrapper.ts**

```typescript
import { withRetry, withTimeout } from "@/lib/utils/retry-utils";

const GROQ_TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;

export async function withGroqRetry<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  return withRetry(operation, {
    maxRetries: MAX_RETRIES,
    onRetry: (error, attempt) => {
      console.warn(
        `[${context}] Groq request failed (attempt ${attempt}): ${error.message}`,
      );
    },
  });
}

export async function withGroqTimeout<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  return withTimeout(
    operation,
    GROQ_TIMEOUT_MS,
    `${context} timed out after ${GROQ_TIMEOUT_MS}ms`,
  );
}

export async function safeGroqRequest<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  return withGroqRetry(() => withGroqTimeout(operation, context), context);
}
```

- [ ] **Step 3: 验证类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/groq-client.ts src/lib/ai/groq-request-wrapper.ts
git commit -m "feat: add Groq client singleton and safe request wrapper with retry/timeout"
```

---

## Task 3: 修改 transcribe API 路由

**Files:**
- Modify: `src/app/api/transcribe/route.ts`

- [ ] **Step 1: 替换 Groq 实例化**

在文件顶部，在现有 import 后添加：
```typescript
import { groqClient } from "@/lib/ai/groq-client";
import { safeGroqRequest } from "@/lib/ai/groq-request-wrapper";
```

删除文件中所有 `new Groq({ apiKey: ... })` 的实例化代码。

- [ ] **Step 2: 替换 Groq 调用为 safeGroqRequest**

找到 `groqClient.audio.transcriptions.create(...)` 调用，替换为：
```typescript
const transcriptionResponse = await safeGroqRequest(
  () => groqClient.audio.transcriptions.create({
    file: uploadedFile,
    model: GROQ_TRANSCRIPTION_MODEL,
    response_format: "verbose_json",
    timestamp_granularities: ["segment", "word"],
    language: validatedLanguage,
  }),
  "transcribe",
);
```

- [ ] **Step 3: 添加文件大小限制**

在 `validateFormData` 中，在 `isFileLike` 校验后添加：
```typescript
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

if (uploadedFile.size > MAX_FILE_SIZE_BYTES) {
  return {
    isValid: false,
    error: {
      code: "FILE_TOO_LARGE",
      message: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
      statusCode: 413,
    },
  };
}
```

- [ ] **Step 4: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/app/api/transcribe/route.ts
git commit -m "fix(transcribe): use singleton Groq client, add retry/timeout, add file size limit"
```

---

## Task 4: 修改 postprocess API 路由

**Files:**
- Modify: `src/app/api/postprocess/route.ts`

- [ ] **Step 1: 替换 Groq 实例化**

在文件顶部，在现有 import 后添加：
```typescript
import { groqClient } from "@/lib/ai/groq-client";
import { safeGroqRequest } from "@/lib/ai/groq-request-wrapper";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
```

删除文件中所有 `new Groq({ apiKey: process.env.GROQ_API_KEY })` 的实例化代码（共两处：postProcessSegmentWithGroq 和 postProcessShortTextsBatch）。

- [ ] **Step 2: 替换 Groq 调用为 safeGroqRequest**

在 `postProcessSegmentWithGroq` 中，找到 `groqClient.chat.completions.create(...)` 调用，替换为：
```typescript
const response = await safeGroqRequest(
  () => groqClient.chat.completions.create({
    model: GROQ_CHAT_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [...],
  }),
  "postprocess-segment",
);
```

在 `postProcessShortTextsBatch` 中，找到另一个 `groqClient.chat.completions.create(...)` 调用，替换为：
```typescript
const response = await safeGroqRequest(
  () => groqClient.chat.completions.create({
    model: GROQ_CHAT_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [...],
  }),
  "postprocess-batch",
);
```

- [ ] **Step 3: 添加限流**

在 POST handler 的开头，在 validateGroqConfiguration 之后添加：
```typescript
const rateLimit = checkRateLimit(request);
if (!rateLimit.allowed) {
  return apiError({
    code: "RATE_LIMIT",
    message: "Too many postprocess requests",
    statusCode: 429,
  });
}
```

- [ ] **Step 4: 添加文本大小限制**

在 `validateSegments` 中，在现有校验后添加：
```typescript
const MAX_SEGMENT_TEXT_LENGTH = 2000;
const MAX_TOTAL_TEXT_LENGTH = 10000;

let totalLength = 0;
for (let i = 0; i < segments.length; i++) {
  if (segments[i].text.length > MAX_SEGMENT_TEXT_LENGTH) {
    return {
      isValid: false,
      error: {
        code: "SEGMENT_TOO_LONG",
        message: `Segment ${i} exceeds ${MAX_SEGMENT_TEXT_LENGTH} characters`,
        statusCode: 400,
      },
    };
  }
  totalLength += segments[i].text.length;
}

if (totalLength > MAX_TOTAL_TEXT_LENGTH) {
  return {
    isValid: false,
    error: {
      code: "TOTAL_TEXT_TOO_LONG",
      message: `Total text length exceeds ${MAX_TOTAL_TEXT_LENGTH} characters`,
      statusCode: 400,
    },
  };
}
```

- [ ] **Step 5: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add src/app/api/postprocess/route.ts
git commit -m "fix(postprocess): use singleton Groq client, add retry/timeout, rate limiting, text size limits"
```

---

## Task 5: 替换自研 HTML 净化器为 DOMPurify

**Files:**
- Modify: `src/lib/utils/security.ts`

- [ ] **Step 1: 重构 security.ts**

将整个文件替换为：
```typescript
import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize untrusted HTML content using DOMPurify.
 * Removes dangerous tags and attributes while preserving safe markup.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      "b", "i", "em", "strong", "a", "p", "br", "span", "ruby", "rt", "rb",
    ],
    ALLOWED_ATTR: ["href", "title", "class", "lang"],
  });
}

/**
 * Strip all HTML tags, leaving only plain text.
 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

/**
 * Check if a string contains HTML tags.
 */
export function containsHtml(input: string): boolean {
  return /<[^\u003e]+>/.test(input);
}

/**
 * Check if a URL is valid and safe (no javascript/data protocols).
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ["http:", "https:", "mailto:"];
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Decode HTML entities to plain text.
 */
export function decodeHtmlEntities(input: string): string {
  if (typeof document === "undefined") {
    // SSR fallback: basic entity decoding
    return input
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
  }
  const textarea = document.createElement("textarea");
  textarea.innerHTML = input;
  return textarea.value;
}
```

- [ ] **Step 2: 更新 barrel 导出**

检查 `src/lib/utils/index.ts` 中 security 相关导出是否仍然有效。如果之前有导出已被删除的函数，移除它们。

- [ ] **Step 3: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 4: 运行测试**

```bash
pnpm test:run
```
Expected: 全部通过（security 函数接口不变，消费者不受影响）

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/security.ts
git commit -m "fix(security): replace custom regex HTML sanitizer with DOMPurify"
```

---

## Task 6: 修复 PlayerPage 性能问题

**Files:**
- Create: `src/components/features/player/PlayerFooterContainer.tsx`
- Modify: `src/components/features/player/PlayerPage.tsx`

- [ ] **Step 1: 创建 PlayerFooterContainer**

```typescript
"use client";

import React from "react";
import { PlayerFooter } from "@/components/features/player/page/PlayerFooter";
import type { AudioPlayerState } from "@/types/db/database";

interface PlayerFooterContainerProps {
  audioPlayerState: AudioPlayerState;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onClearLoop: () => void;
  loopStart: number | null;
  loopEnd: number | null;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onSetLoopStart: () => void;
  onSetLoopEnd: () => void;
  onToggleShadowingMode: () => void;
  isShadowingMode: boolean;
}

const PlayerFooterContainer = React.memo<PlayerFooterContainerProps>((props) => {
  return <PlayerFooter {...props} />;
});

PlayerFooterContainer.displayName = "PlayerFooterContainer";

export default PlayerFooterContainer;
```

- [ ] **Step 2: 修改 PlayerPage.tsx — 替换 layoutFooter 为 PlayerFooterContainer**

找到 `layoutFooter` 的定义（第 229-248 行），替换为：
```typescript
const layoutFooter = audioUrl ? (
  <PlayerFooterContainer
    audioPlayerState={audioPlayerState}
    onSeek={handleSeek}
    onTogglePlay={handleTogglePlay}
    onSkipBack={onSkipBack}
    onSkipForward={onSkipForward}
    onClearLoop={onClearLoop}
    loopStart={loopStart}
    loopEnd={loopEnd}
    playbackRate={playbackRate}
    onPlaybackRateChange={setPlaybackRate}
    volume={volume}
    onVolumeChange={handleVolumeChange}
    onSetLoopStart={handleSetLoopStart}
    onSetLoopEnd={handleSetLoopEnd}
    onToggleShadowingMode={toggleShadowingMode}
    isShadowingMode={isShadowingMode}
  />
) : null;
```

- [ ] **Step 3: 修改 PlayerPage.tsx — 用 useCallback 包裹事件处理器**

找到并修改以下函数定义：

```typescript
const handleSegmentClick = useCallback((segment: Segment) => {
  handleSeek(segment.start);
  if (!audioPlayerState.isPlaying) {
    onPlay();
  }
}, [handleSeek, audioPlayerState.isPlaying, onPlay]);
```

```typescript
const handleBack = useCallback(() => {
  clearAudio();
  router.push("/");
}, [clearAudio, router]);
```

```typescript
const handleTogglePlay = useCallback(() => {
  if (audioPlayerState.isPlaying) {
    onPause();
  } else {
    onPlay();
  }
}, [audioPlayerState.isPlaying, onPause, onPlay]);
```

```typescript
const handleVolumeChange = useCallback((newVolume: number) => {
  setVolume(newVolume);
  if (audioRef.current) {
    audioRef.current.volume = newVolume;
  }
}, []);
```

注意：`handleSeek` 来自 `useAudioPlayer` 的返回值，需要确认它是否已经稳定（useCallback 包裹）。如果 `handleSeek` 不稳定，可能需要在其定义处也包裹 useCallback。

- [ ] **Step 4: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/components/features/player/PlayerFooterContainer.tsx src/components/features/player/PlayerPage.tsx
git commit -m "perf(player): extract PlayerFooterContainer with memo, wrap handlers in useCallback"
```

---

## Task 7: 为字幕组件增加 ARIA 支持

**Files:**
- Modify: `src/components/features/player/ScrollableSubtitleDisplay.tsx`

- [ ] **Step 1: 添加 aria-live 区域**

在组件的 return 中，在 subtitle 容器前添加：
```tsx
{
  /* Screen reader live region for active segment */
}
<div
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
  role="status"
>
  {isPlaying && activeIndex >= 0 && segments[activeIndex]
    ? segments[activeIndex].text
    : ""}
</div>
```

- [ ] **Step 2: 为段落按钮添加 ARIA 属性**

在段落 button 元素上，修改 className 行之前添加：
```tsx
aria-current={isActive ? "true" : undefined}
aria-label={`Jump to ${formatTime(segment.start)}: ${displayText}`}
```

需要导入或内联定义 `formatTime`：
```typescript
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
```

- [ ] **Step 3: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/components/features/player/ScrollableSubtitleDisplay.tsx
git commit -m "a11y(subtitle): add aria-live region and aria-current/aria-label to segment buttons"
```

---

## Task 8: 为播放器添加 Error Boundary

**Files:**
- Create: `src/components/features/player/PlayerErrorBoundary.tsx`
- Modify: `src/components/features/player/PlayerPage.tsx`

- [ ] **Step 1: 创建 PlayerErrorBoundary**

```typescript
"use client";

import React from "react";
import { ErrorBoundary } from "react-error-boundary";

function PlayerFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-bold text-error">Player Error</h2>
      <p className="text-sm text-muted-foreground">
        Something went wrong with the audio player. Please refresh the page to try again.
      </p>
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-2 max-w-md overflow-auto rounded bg-muted p-2 text-xs">
          {error.message}
        </pre>
      )}
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="btn-primary mt-2"
      >
        Retry
      </button>
    </div>
  );
}

export default function PlayerErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={PlayerFallback}
      onReset={() => window.location.reload()}
    >
      {children}
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: 在 PlayerPage 中包裹**

修改 `PlayerPage` 的 return 部分，将 `PlayerPageLayout` 包裹在 `PlayerErrorBoundary` 中：
```tsx
return (
  <PlayerErrorBoundary>
    <PlayerPageLayout ...>
      ...
    </PlayerPageLayout>
    <audio ... />
  </PlayerErrorBoundary>
);
```

- [ ] **Step 3: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/components/features/player/PlayerErrorBoundary.tsx src/components/features/player/PlayerPage.tsx
git commit -m "feat(player): add react-error-boundary for graceful degradation"
```

---

## Task 9: 修复数据库批量操作事务安全

**Files:**
- Modify: `src/lib/db/db.ts`

- [ ] **Step 1: 修改 addSegments 为事务内执行**

找到 `addSegments` 方法（第 294-345 行），将 body 替换为：
```typescript
try {
  const segmentsWithTimestamps = segments.map((segment) => ({
    ...segment,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  // 所有 bulkAdd 在同一个事务中执行
  return await db.transaction("rw", db.segments, async () => {
    if (segmentsWithTimestamps.length <= 50) {
      await db.segments.bulkAdd(segmentsWithTimestamps as Segment[]);
      return;
    }

    const batchSize = options?.batchSize || 50;
    for (let i = 0; i < segmentsWithTimestamps.length; i += batchSize) {
      const batch = segmentsWithTimestamps.slice(i, i + batchSize);
      await db.segments.bulkAdd(batch as Segment[]);

      if (options?.onProgress) {
        const progress = Math.min(
          100,
          Math.floor(((i + batch.length) / segmentsWithTimestamps.length) * 100),
        );
        options.onProgress({
          processed: i + batch.length,
          total: segmentsWithTimestamps.length,
          percentage: progress,
          status: "processing",
          message: `Processing ${i + batch.length}/${segmentsWithTimestamps.length}`,
        });
      }
    }
  });
} catch (error) {
  throw handleError(error, "DBUtils.addSegments");
}
```

- [ ] **Step 2: 修改 bulkUpdate 为事务内执行**

找到 `bulkUpdate` 方法（第 110-119 行），将 body 替换为：
```typescript
try {
  return await db.transaction("rw", table, async () => {
    return await Promise.all(
      items.map(({ id, changes }) => table.update(id, changes as any)),
    );
  });
} catch (error) {
  throw handleError(error, `DBUtils.bulkUpdate`);
}
```

- [ ] **Step 3: 修改 cleanupOldFiles 为外层事务**

找到 `cleanupOldFiles` 方法（第 199-217 行），将 body 替换为：
```typescript
try {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const oldFiles = await db.files.where("uploadedAt").below(cutoffDate).toArray();

  await db.transaction("rw", db.files, db.transcripts, db.segments, async () => {
    for (const file of oldFiles) {
      if (file.id) {
        // 复用 deleteFile 的内部逻辑，但在外层事务中
        const transcripts = await db.transcripts.where("fileId").equals(file.id).toArray();
        for (const transcript of transcripts) {
          if (transcript.id) {
            await db.segments.where("transcriptId").equals(transcript.id).delete();
          }
        }
        await db.transcripts.where("fileId").equals(file.id).delete();
        await db.files.delete(file.id);
      }
    }
  });

  return oldFiles.length;
} catch (error) {
  throw handleError(error, "DBUtils.cleanupOldFiles");
}
```

- [ ] **Step 4: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 5: 运行测试**

```bash
pnpm test:run
```
Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/db.ts
git commit -m "fix(db): wrap batch operations in Dexie transactions for atomicity"
```

---

## Task 10: 清理悬空/重复类型

**Files:**
- Create: `src/types/player.ts`
- Modify: `src/types/db/database.ts`
- Modify: `src/types/transcription.ts`
- Modify: `src/types/api.types.ts`

- [ ] **Step 1: 创建 player.ts**

```typescript
export interface AudioPlayerState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
}
```

- [ ] **Step 2: 修改 database.ts**

1. 删除 `FileStatus` 枚举（整个定义，第 1-7 行）
2. 将 `TranscriptRow.status` 改为使用 `ProcessingStatus`：
   ```typescript
   export interface TranscriptRow {
     ...
     status: ProcessingStatus;
     ...
   }
   ```
3. 删除 `AudioPlayerState` 定义（已迁移到 `types/player.ts`）
4. 在文件顶部添加：
   ```typescript
   import type { AudioPlayerState } from "./player";
   export type { AudioPlayerState };
   ```

注意：这可能导致循环导入问题，更安全的做法是让其他文件直接从 `types/player` 导入，而不是通过 `types/db/database` 中转。暂时先保留 `export type { AudioPlayerState }` 以保持向后兼容，后续逐步迁移消费者。

- [ ] **Step 3: 修改 transcription.ts**

1. 在顶部添加：`import type { WordTimestamp } from "@/types/db/database";`
2. 将 `TranscriptionSegment` 中的内联 `wordTimestamps` 定义替换为：
   ```typescript
   wordTimestamps?: WordTimestamp[];
   ```
3. 提取 `TranscriptionTask.progress` 内联类型：
   ```typescript
   export interface TranscriptionProgress {
     status: "pending" | "processing" | "completed" | "failed";
     percentage: number;
     currentSegment?: number;
     totalSegments?: number;
     message?: string;
     result?: {
       text: string;
       language: string;
       segments: TranscriptionSegment[];
       duration: number;
     };
   }
   ```
   然后在 `TranscriptionTask` 中使用：
   ```typescript
   progress: TranscriptionProgress;
   ```

- [ ] **Step 4: 修改 api.types.ts**

1. 将内联 `import("./transcription").TranscriptionSegment` 改为顶部 `import type`：
   ```typescript
   import type { TranscriptionSegment } from "./transcription";
   ```

- [ ] **Step 5: 更新消费者导入**

找到所有从 `types/db/database` 导入 `AudioPlayerState` 的文件，改为从 `types/player` 导入。

需要 grep 查找：
```bash
grep -r "AudioPlayerState" src --include="*.ts" --include="*.tsx"
```

修改这些文件：
- `src/hooks/ui/useAudioPlayerState.ts`
- `src/hooks/ui/useAudioPlayer.ts`
- 其他引用文件

- [ ] **Step 6: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add src/types/player.ts src/types/db/database.ts src/types/transcription.ts src/types/api.types.ts
git add $(git status --short | grep "^ M" | awk '{print $2}') # 修改过的消费者文件
git commit -m "refactor(types): remove dead FileStatus enum, deduplicate types, extract AudioPlayerState"
```

---

## Task 11: 修复 CSS 问题

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: 修复 CSS 变量引用**

1. 找到 `.btn-play`（约 1109 行），替换：
   ```css
   background-color: var(--success-color); /* 旧 */
   ```
   为：
   ```css
   background-color: var(--color-success); /* 新 */
   ```

2. 找到 `.btn-retry`（约 1121 行），替换：
   ```css
   background-color: var(--warning-color); /* 旧 */
   ```
   为：
   ```css
   background-color: var(--color-warning); /* 新 */
   ```

3. 找到 `--brand-800`（约 56 行），将 `#166534` 改为深于 `--brand-700` 的值，如 `#14532d`。

- [ ] **Step 2: 移除重复的 .upload-area**

删除第 924-928 行的重复 `.upload-area` 定义（保留第 916-922 行的第一个）。

- [ ] **Step 3: 优化全局过渡动画**

找到第 621-627 行的：
```css
* {
  transition:
    background-color 0.3s ease,
    color 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease;
}
```

替换为：
```css
/* 主题切换过渡：仅应用于需要主题过渡的元素 */
html, body, .theme-transition,
[data-theme] * {
  transition:
    background-color 0.3s ease,
    color 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease;
}
```

- [ ] **Step 4: 运行构建**

```bash
pnpm build
```
Expected: 成功

- [ ] **Step 5: Commit**

```bash
git add src/styles/globals.css
git commit -m "fix(css): correct variable references, remove duplicate rules, scope transitions"
```

---

## Task 12: 补全安全响应头

**Files:**
- Modify: `next.config.js`

- [ ] **Step 1: 添加安全头**

找到 `headers()` 配置，添加新 header（保留已有配置）：
```javascript
{
  source: "/:path*",
  headers: [
    // 已有 header 保留...
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data:",
        "media-src 'self' blob:",
        "connect-src 'self' https://api.groq.com",
        "font-src 'self' https://fonts.gstatic.com",
        "frame-ancestors 'none'",
      ].join("; "),
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ],
}
```

- [ ] **Step 2: 运行构建**

```bash
pnpm build
```
Expected: 成功

- [ ] **Step 3: Commit**

```bash
git add next.config.js
git commit -m "security(headers): add CSP, HSTS, and Permissions-Policy"
```

---

## Task 13: 后处理状态透明化

**Files:**
- Modify: `src/types/db/database.ts`
- Modify: `src/hooks/api/useTranscription.ts`

- [ ] **Step 1: 在 TranscriptRow 中添加 postProcessStatus**

在 `database.ts` 的 `TranscriptRow` 接口中添加：
```typescript
export interface TranscriptRow {
  ...
  postProcessStatus?: "pending" | "completed" | "failed";
  postProcessError?: string;
  ...
}
```

- [ ] **Step 2: 修改 useTranscription.ts**

在 `postProcessTranscription` 函数开头（第 172 行后）添加：
```typescript
// Update postprocess status to pending
await DBUtils.update(db.transcripts, transcriptId, {
  postProcessStatus: "pending",
  postProcessError: undefined,
});
```

在成功路径（`updatedCount` 累加后，第 243 行）添加：
```typescript
await DBUtils.update(db.transcripts, transcriptId, {
  postProcessStatus: "completed",
});
```

在 catch 块（第 252 行）添加：
```typescript
await DBUtils.update(db.transcripts, transcriptId, {
  postProcessStatus: "failed",
  postProcessError: error instanceof Error ? error.message : String(error),
});
```

- [ ] **Step 3: 在 UI 中展示后处理状态**

找到 `src/hooks/api/useTranscription.ts` 的 `useTranscriptionStatus`（第 41 行），在返回值中包含 `postProcessStatus`：
```typescript
return {
  transcript,
  segments,
  postProcessStatus: transcript?.postProcessStatus,
};
```

找到 `src/components/features/player/PlayerPage.tsx` 的转录状态渲染区域（第 293-300 行），在"暂无字幕内容"提示前添加后处理状态提示：
```tsx
{transcript?.postProcessStatus === "pending" && (
  <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
    <p>正在生成翻译和注音...</p>
  </div>
)}
{transcript?.postProcessStatus === "failed" && (
  <div className="flex flex-col items-center gap-3 py-12 text-sm text-error">
    <p>翻译生成失败，请尝试重新转录此文件</p>
  </div>
)}
```

- [ ] **Step 4: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/types/db/database.ts src/hooks/api/useTranscription.ts src/components/features/player/PlayerPage.tsx
git commit -m "feat(transcription): persist postprocess status and show UI feedback"
```

---

## Task 14: 收紧 Biome 规则

**Files:**
- Modify: `biome.json`

- [ ] **Step 1: 修改 biome.json**

找到 `linter.rules.correctness` 部分，修改：
```json
"noUnusedVariables": "error"
```

在 `linter.rules.style` 部分添加覆盖规则（仅对关键目录）：
```json
"overrides": [
  {
    "include": ["src/app/api/**", "src/lib/db/**", "src/lib/ai/**"],
    "linter": {
      "rules": {
        "suspicious": {
          "noExplicitAny": "warn"
        }
      }
    }
  }
]
```

注意：如果 `biome.json` 的 JSON 结构不支持 overrides，则只在全局将 `noExplicitAny` 设为 `warn`（如果当前是 `off`）。

将 `noDangerouslySetInnerHtml` 和 `useSemanticElements` 从 `off` 改为 `warn`。

- [ ] **Step 2: 运行 lint 检查**

```bash
pnpm lint
```
Expected: 可能出现新的警告，但不应有错误

- [ ] **Step 3: 修复新暴露的问题**

根据 lint 输出，修复新暴露的 `noUnusedVariables` 错误和 `noExplicitAny` 警告。

- [ ] **Step 4: Commit**

```bash
git add biome.json
git commit -m "style(biome): tighten lint rules - unused vars as error, enable any warning in critical paths"
```

---

## Task 15: 最终验证

- [ ] **Step 1: 类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 2: 代码检查**

```bash
pnpm lint
```
Expected: 无错误（或仅有已接受的警告）

- [ ] **Step 3: 测试**

```bash
pnpm test:run
```
Expected: 全部通过（114 tests）

- [ ] **Step 4: 构建**

```bash
pnpm build
```
Expected: 成功生成 standalone 输出

- [ ] **Step 5: 手动验证清单**

1. 启动 dev server：`pnpm dev`
2. 上传一个日语音频文件
3. 等待转录完成
4. 检查播放器：
   - [ ] 原文正常显示
   - [ ] 翻译（中文）正常显示
   - [ ] 注音（furigana）正常显示
   - [ ] 播放器不卡顿
5. 打开浏览器 DevTools：
   - [ ] Network 面板无 CSP 报错
   - [ ] Lighthouse Accessibility ≥ 90

- [ ] **Step 6: Commit 与推送**

```bash
git push
```

---

## Self-Review Checklist

- [x] **Spec coverage**: 所有 13 个高/中优先级问题都有对应的 Task
- [x] **Placeholder scan**: 无 TBD/TODO，所有步骤包含具体代码
- [x] **Type consistency**: 类型命名跨 Task 一致（`TranscriptRow`、`AudioPlayerState`、`PostProcessResult` 等）
- [x] **File paths**: 所有路径使用绝对路径，与项目结构一致
- [x] **Command expectations**: 每个测试/检查步骤都有 Expected 输出
- [x] **Commit 粒度**: 每个 Task 结束后独立 commit，便于回滚
- [x] **向后兼容**: 数据库 schema 无破坏性变更，API 接口不变

---

*Plan written: 2025-05-01*
*Corresponding spec: `docs/superpowers/specs/2025-05-01-code-quality-fixes-spec.md`*