# Shadowing Learning — 代码质量修复规范

> **范围**：修复代码质量审查中识别的所有高/中优先级问题
> **目标**：提升可靠性、安全性、可维护性与性能
> **预计工期**：2-3 天（按任务并行拆分后）

---

## 1. 背景与问题总览

上次代码质量审查识别了 13 个关键问题，分布在 5 个领域：

| 领域 | 问题数 | 最高风险 |
|------|--------|----------|
| API Routes | 4 | 核心路由未使用已存在的重试/超时/限流工具 |
| 工具函数/安全 | 3 | 自研 HTML 净化器存在安全漏洞 |
| React 组件/性能 | 3 | PlayerPage 高频重渲染导致全树抖动 |
| 数据库/类型 | 2 | 批量操作缺乏事务原子性；类型冗余 |
| CSS/配置 | 1 | 引用不存在的 CSS 变量；缺失安全头 |

---

## 2. 设计原则

1. **工具建设 → 业务接入**：项目已有完善的基础设施（retry-utils、rate-limiter、error-handler），本次修复的核心是让业务代码真正使用它们。
2. **最小侵入**：不改业务逻辑，只补强边界情况处理。
3. **可验证**：每个修复都附带测试（单元测试或集成测试）。
4. **向后兼容**：数据库 schema 和 API 接口不变，仅增强内部实现。

---

## 3. 详细设计

### 3.1 API 可靠性增强（P0）

#### 3.1.1 为 transcribe / postprocess 接入重试 + 超时 + 限流

**当前状态**：
- `src/lib/utils/retry-utils.ts` 提供 `withRetry`、`withTimeout`、`CircuitBreaker`
- `src/lib/utils/rate-limiter.ts` 提供 `checkRateLimit`
- 但 `src/app/api/transcribe/route.ts` 和 `src/app/api/postprocess/route.ts` 均未使用

**设计**：

创建 `src/lib/ai/groq-client.ts`（模块级单例）：
```typescript
import Groq from "groq-sdk";

export const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
```

创建 `src/lib/ai/groq-request-wrapper.ts`（统一封装）：
```typescript
import { withRetry, withTimeout } from "@/lib/utils/retry-utils";
import type Groq from "groq-sdk";

const GROQ_TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;

export async function withGroqRetry<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  return withRetry(operation, {
    maxRetries: MAX_RETRIES,
    onRetry: (error, attempt) => {
      console.warn(`[${context}] Groq request failed (attempt ${attempt}):`, error.message);
    },
  });
}

export async function withGroqTimeout<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  return withTimeout(operation, GROQ_TIMEOUT_MS, `${context} timed out after ${GROQ_TIMEOUT_MS}ms`);
}

export async function safeGroqRequest<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  return withGroqRetry(() => withGroqTimeout(operation, context), context);
}
```

**修改 transcribe**：
- 替换 `new Groq(...)` 为 `groqClient`
- 替换 `groqClient.audio.transcriptions.create(...)` 为 `safeGroqRequest(() => groqClient.audio.transcriptions.create(...), "transcribe")`
- 复用 `checkRateLimit`（已有）

**修改 postprocess**：
- 替换两处 `new Groq(...)` 为 `groqClient`
- 为 Groq chat.completions.create 调用包裹 `safeGroqRequest`
- **新增限流**：复用 `checkRateLimit` 和 `getRateLimitHeaders`

#### 3.1.2 为 postprocess 添加文件/文本大小限制

**设计**：
- 在 `postProcessSchema` 中增加验证：
  - 单段文本最大长度：2000 字符
  - 总文本最大长度：10000 字符（所有 segments 累加）
  - segments 数量上限：100（已有）

---

### 3.2 安全修复（P0）

#### 3.2.1 替换自研 HTML 净化器

**当前状态**：`src/lib/utils/security.ts`（799 行）完全使用正则实现 HTML 解析与净化。

**设计**：
- 安装 `isomorphic-dompurify`（SSR 安全版本）
- 保留 `security.ts` 的导出接口不变，内部实现替换为 `DOMPurify.sanitize`
- 移除所有正则解析逻辑（约 700 行）
- 保留辅助函数（URL 校验、HTML 实体解码等不依赖正则的部分）

#### 3.2.2 补全安全响应头

**设计**：在 `next.config.js` 的 `headers()` 中添加：
```javascript
{
  source: "/:path*",
  headers: [
    { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self' https://api.groq.com; font-src 'self' https://fonts.gstatic.com;" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ],
}
```

---

### 3.3 组件性能优化（P1）

#### 3.3.1 修复 PlayerPage 高频重渲染

**根因**：`audioPlayerState.currentTime` 高频变化 → 整个 `PlayerPage` 重渲染 → 所有子树重渲染。

**设计**：
1. **将事件处理器包裹 `useCallback`**：
   - `handleSegmentClick`、`handleBack`、`handleTogglePlay`、`handleVolumeChange` 等
   - 这样 `ScrollableSubtitleDisplay` 的 `React.memo` 才能真正生效

2. **将 `layoutFooter` 提取为独立组件** `PlayerFooterContainer`：
   - 接收 `audioPlayerState` 的解构值（而非整个对象），避免不必要的重渲染
   - 用 `React.memo` 包裹

3. **将 `currentTime` 的传递改为 ref 模式**（可选优化）：
   - `ScrollableSubtitleDisplay` 不需要 `currentTime` 触发重渲染，它只需要在滚动定位时读取当前值
   - 改为 `currentTimeRef` 模式，组件内部通过 `requestAnimationFrame` 或 `setInterval` 自主读取
   - 但这改动较大，本次先只做 useCallback 优化

#### 3.3.2 为字幕组件增加 ARIA 支持

**设计**：
1. `ScrollableSubtitleDisplay`：
   - 当前激活段落 `<button>` 增加 `aria-current="true"`
   - 在组件顶部增加一个 visually hidden 的 `aria-live="polite"` 区域，当 `activeIndex` 变化时朗读当前段落文本
   - 为段落按钮增加描述性 `aria-label`：`aria-label={`跳转到 ${formatTime(segment.start)}：${segment.text}`}`

2. `PlayerPage`：
   - audio 控件增加 `aria-controls={subtitleContainerId}`
   - 错误状态容器增加 `role="alert"` 和 `aria-live="assertive"`

---

### 3.4 数据库/类型修复（P1）

#### 3.4.1 修复批量操作事务安全

**设计**：
1. `addSegments`：将分片 bulkAdd 包裹在同一个 Dexie 事务中
2. `bulkUpdate`：将逐条更新改为事务内执行
3. `cleanupOldFiles`：整批清理使用外层事务包裹

#### 3.4.2 清理悬空/重复类型

**设计**：
1. 删除 `FileStatus` 枚举（悬空）
2. `TranscriptRow.status` 复用 `ProcessingStatus` 类型
3. 将 `AudioPlayerState` 迁移到 `src/types/player.ts`
4. `TranscriptionSegment.wordTimestamps` 复用 `WordTimestamp` 类型
5. 提取 `TranscriptionTask.progress` 内联类型为独立接口 `TranscriptionProgress`

---

### 3.5 CSS/规范修复（P1-P2）

#### 3.5.1 修复 CSS 变量引用错误

**设计**：
1. `.btn-play`：`var(--success-color)` → `var(--color-success)`
2. `.btn-retry`：`var(--warning-color)` → `var(--color-warning)`
3. `.upload-area` 移除重复定义（第 917 和 924 行）
4. 修复 `--brand-800` 色值，使其深于 `--brand-700`

#### 3.5.2 优化全局过渡动画

**设计**：
- 将 `* { transition: ... }` 改为仅对 `body` 和 `.theme-transition` 作用域应用
- 或改用 CSS 变量本身的过渡（`transition` 只作用于 `background-color`/`color`/`border-color`）

#### 3.5.3 统一代码语言

**设计**：
- 将 API routes 中的中英混杂注释统一为英文
- 日志信息保持英文（便于国际化协作）
- 用户可见的错误消息保持中文（通过 i18n 翻译文件）

#### 3.5.4 收紧 Biome 规则

**设计**：
- `noUnusedVariables`：warn → error
- 在 `src/app/api/**` 和 `src/lib/db/**` 等高影响区域开启 `noExplicitAny: warn`
- `noDangerouslySetInnerHtml` 和 `useSemanticElements` 恢复为 warn

---

### 3.6 Error Boundary（P1）

#### 3.6.1 为播放器添加 Error Boundary

**设计**：
- 使用 `react-error-boundary` 库（轻量，社区标准）
- 包裹 `PlayerPageLayout` 内部内容（不包括音频元素）
- 降级 UI：显示"播放器出现错误，请刷新页面重试" + 刷新按钮

---

### 3.7 后处理状态透明化（P1）

#### 3.7.1 让 postprocess 失败可被感知

**设计**：
1. 在 `TranscriptRow` 中增加 `postProcessStatus` 字段：`'pending' | 'completed' | 'failed'`
2. `useTranscription.ts` 中：
   - `postProcessTranscription` 开始时将状态设为 `'pending'`
   - 成功设为 `'completed'`，失败设为 `'failed'` 并记录错误
3. UI 层通过 `useTranscriptionStatus` 读取该状态
4. 播放器页面展示"正在生成翻译..."或"翻译生成失败"提示

---

## 4. 文件变更清单

### 新增文件
| 文件 | 职责 |
|------|------|
| `src/lib/ai/groq-client.ts` | Groq SDK 模块级单例 |
| `src/lib/ai/groq-request-wrapper.ts` | 统一的重试/超时封装 |
| `src/types/player.ts` | 播放器相关类型（从 database.ts 迁移） |
| `src/components/features/player/PlayerFooterContainer.tsx` | 提取 layoutFooter 为独立 memo 组件 |
| `src/components/features/player/PlayerErrorBoundary.tsx` | Error Boundary 包装器 |

### 修改文件（核心）
| 文件 | 修改内容 |
|------|----------|
| `src/app/api/transcribe/route.ts` | 接入 groq-client + safeGroqRequest + 文件大小限制 |
| `src/app/api/postprocess/route.ts` | 接入 groq-client + safeGroqRequest + 限流 + 文本大小限制 |
| `src/lib/utils/security.ts` | 替换为 DOMPurify 封装 |
| `src/hooks/api/useTranscription.ts` | postprocess 状态持久化 + 错误上报 |
| `src/components/features/player/PlayerPage.tsx` | useCallback 包裹 + layoutFooter 提取 + ARIA |
| `src/components/features/player/ScrollableSubtitleDisplay.tsx` | ARIA 属性 + aria-live |
| `src/lib/db/db.ts` | 批量操作事务包裹 |
| `src/styles/globals.css` | 修复变量引用 + 移除重复 + 优化过渡 |
| `src/types/db/database.ts` | 清理悬空类型 + 迁移 AudioPlayerState |
| `src/types/transcription.ts` | 复用 WordTimestamp + 提取 TranscriptionProgress |
| `src/types/api.types.ts` | 统一 import 方式 |
| `next.config.js` | 补全 CSP + HSTS + Permissions-Policy |
| `biome.json` | 收紧规则 |
| `package.json` | 添加 isomorphic-dompurify + react-error-boundary |

---

## 5. 测试策略

1. **单元测试**：
   - `groq-request-wrapper.ts`：测试重试/超时逻辑（使用 mock）
   - `security.ts`：测试 DOMPurify 封装接口不变
   - `db.ts`：测试批量操作的事务原子性（使用 fake-indexeddb）

2. **集成测试**：
   - API routes：测试限流、错误降级、响应格式
   - PlayerPage：测试 memo 生效（通过 React Testing Library 的 render count 断言）

3. **手动验证**：
   - 转录一个音频文件，验证翻译正常生成
   - 检查浏览器 DevTools 的 Network/Performance 面板
   - 检查 Lighthouse 的 Accessibility 和 Security 分数

---

## 6. 风险评估与回滚

| 风险 | 缓解措施 |
|------|----------|
| DOMPurify 引入导致 SSR 构建失败 | 使用 `isomorphic-dompurify`，SSR 安全 |
| Error Boundary 捕获不应捕获的错误 | 配置 `onError` 只捕获渲染错误，不捕获事件处理器错误 |
| 事务包裹导致性能下降 | 测试大批量插入（1000+ segments）的耗时对比 |
| CSP 头过严导致资源加载失败 | 先使用 `Content-Security-Policy-Report-Only` 观察一周 |

---

## 7. 成功标准

1. `pnpm type-check` 零错误
2. `pnpm lint` 零错误（Biome 收紧后）
3. `pnpm test:run` 全部通过（新增测试 + 现有测试）
4. `pnpm build` 成功生成 standalone 输出
5. Lighthouse Accessibility 分数 ≥ 90
6. 转录一个日语音频文件，验证：
   - 原文正常显示
   - 翻译（中文）正常显示
   - 注音（furigana）正常显示
   - 播放器不卡顿

---

*Spec written: 2025-05-01*
*Review status: Pending user review*
