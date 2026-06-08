# 影子跟读(Shadowing)功能设计稿

- **日期**:2026-06-05
- **状态**:已与用户对齐方向,待实现
- **方案**:B — 统一播放控制器(`usePlaybackController`)
- **架构调研依据**:`understand-shadowing` workflow(7 agents,逐文件精读 + 实跑 type-check/test/build)

---

## 1. 背景与现状

目标:把当前的播放器从「带逐句暂停的字幕阅读器」升级为**真正可用的影子跟读训练器**。

### 1.1 现状(已逐文件核实)

活跃栈:`route /player/$fileId` → `PlayerPage.tsx` → `PlayerFooter.tsx`,由 `useAudioPlayer` 驱动一个隐藏的 `<audio>`。

**已能用**:播放/暂停、±10s、进度条拖动、点字幕跳转(`PlayerPage.tsx:179-187`)、当前行高亮+自动滚动(`ScrollableSubtitleDisplay.tsx:38-56,142-189`)、手动 A/B 循环(`useAudioPlayer.ts:76-88`)、音量、数据管线(transcribe→postprocess→IndexedDB→React Query)。逐词高亮与振假名渲染逻辑已写好,但**拿不到数据**。

### 1.2 两个阻断 blocker(必须先解,否则无法验证)

1. **构建失败**:`src/styles/app.css` 在 `@layer components` 内定义 `.card-base`(line 870),又用 `@apply card-base`(lines 880/892/904/918/937/944)引用它。Tailwind v4(`@tailwindcss/vite`)不允许 `@apply` 一个同层自定义类 → `Cannot apply unknown utility class card-base`,`bun run build` 直接中止(唯一错误)。
2. **测试全挂**:18/18 播放器相关测试在 `bun test` 下失败(`Invalid hook call` / `resolveDispatcher() is null`,`@testing-library/react` 绑不上 React 19.2.5)。Vitest→bun:test 迁移未完成:`vi.mocked`(9 处)、`vi.importActual`(setup + router mock)在 bun:test 的 vi shim 中缺失;`package.json` 把 `test`/`test:run` 都指向 `bun test`,无 `vitest.config`。

### 1.3 影子跟读的关键差距(按价值排序)

1. **无逐句自动循环+重复次数**:影子模式仅在句尾暂停一次(`useShadowingMode.ts:39-46`),不回放;A/B 是另一套手动无限循环,两者互不协调。
2. **无重复间留白**:A/B 瞬间回跳无静音;影子模式无限暂停等手动。
3. **慢速 UI 接不到**:`playbackRate` 引擎已生效(`PlayerPage.tsx:97-100`),`PlayerFooter` 收了 props 却没渲染控件;唯一速度滑块在孤儿组件 `AudioPlayer.tsx`(全项目无人引用)。
4. **逐词时间戳为空**:正常路径只读 `segment.words`(`groq-transcription-utils.ts:36`),而 Whisper 不按段返回 words;顶层 `words` 数组只在零段兜底用(`transcribe.ts:254`)→ `wordTimestamps` 存成 `[]`,karaoke 高亮永不点亮。
5. **计时粗糙**:全部依赖 `timeupdate`(~250ms),循环回跳可超出 ~0.25s。
6. **三套各算各的「当前句」**:线性扫描 / 二分 / `getCurrentSegment`,会漂移;二分在句间间隙返回 -1 → 高亮闪没。
7. **大量孤儿/死代码**:整个 `AudioPlayer` 栈、`useKeyboardControls`、`PlayerStatusBanner` 无人渲染(迁移遗留)。

---

## 2. 已定决策

| 维度 | 决策 |
|---|---|
| 循环行为 | **听一遍 → 留白 → 自动重复 N 次 → 自动进下一句**(真正的影子引擎) |
| 慢速播放 | **预设按钮(0.5/0.75/1.0×)+ 练习时自动慢速** |
| 录音对比 | **本轮不做**(列为独立下一期) |
| 测试运行器 | **回退 Vitest** |
| 重复次数 | 默认 **3**,范围 1–5 |
| 跟读留白 | `gap = max(gapFloorMs, lineDuration × gapRatio)`,默认 `gapRatio=1.0`、`gapFloorMs=800` |
| 练习语速 | 默认 **0.75×**(1.0 = 不慢速) |
| 自动进句 | 默认 **开** |
| 显示文本 | `normalizedText ?? text` |
| romaji | **删除**该死字段(无人写入,无索引,无需迁移) |
| 手动 A/B | 保留,作为控制器的特例(repeat=∞、gap=0) |

### 非目标(本轮明确不做)

录音(MediaRecorder)、回放对比、相似度评分、romaji 生成。

---

## 3. 总体架构

```
数据层    transcribe.ts: 顶层 words 按时间分配进各 segment → wordTimestamps 填满
   │
当前句    useActiveSegmentIndex(segments, timeRef)  ← 二分 + 间隙就近兜底，唯一来源
   │        └─ 喂给：高亮/自动滚动、控制器
引擎      usePlaybackController  ← 拥有 <audio> 命令式控制 + 练习循环状态机
   │        └─ rAF 读 audio.currentTime 做帧级边界判定
UI        PlayerFooter(播放 + 速度预设 + 影子开关)
   │        + ShadowingSettings 浮层(挂在 PlayerFooterContainer)
   │        + 进度条循环区标记 + 键盘快捷键(useKeyboardControls 接进 PlayerPage)
页面      PlayerPage 瘦身：audio-sync 与循环交给控制器，自己只负责组装
```

设计原则:每个单元单一职责、接口清晰、可独立测试。把**纯逻辑**(当前句查找、逐词分配、循环 FSM)从 DOM/audio 副作用中剥离出来,使其可确定性单测。

---

## 4. 练习循环状态机(核心)

影子模式下每个当前句运行下述 FSM。**以纯 reducer 实现**(`src/lib/player/shadowing-machine.ts`),不依赖 rAF/audio,便于单测。

### 4.1 状态与转移

```
IDLE        影子关闭或本句结束后停住
  │ enabled && play
  ▼
LISTENING   以 practiceRate 播放 [seg.start, seg.end]
  │ TICK: currentTime ≥ seg.end - ε
  ▼
GAP         暂停（或静音），停留 gapMs = max(gapFloorMs, lineDuration × gapRatio)
  │ GAP_ELAPSED
  ▼
  playsDone + 1 < repeatCount ?
     是 → seek(seg.start)，playsDone++，回到 LISTENING
     否 → autoAdvance ?
              是 → 切到下一句(若有)，playsDone=0，LISTENING
              否 → IDLE（暂停）
```

边界判定:rAF 循环读 `audio.currentTime`,LISTENING 时 `currentTime ≥ seg.end - ε` 即转 GAP(`ε` 取 ~0.03s)。这比 250ms 的 `timeupdate` 精确一个量级。

### 4.2 配置与状态

```ts
interface ShadowingConfig {
  enabled: boolean
  repeatCount: number   // 默认 3，范围 1–5
  gapRatio: number      // 留白 = 句长 × 该值，默认 1.0
  gapFloorMs: number    // 默认 800
  practiceRate: number  // 默认 0.75；1.0 = 不慢速
  autoAdvance: boolean  // 默认 true
}

type ShadowingPhase = 'idle' | 'listening' | 'gap'

interface ShadowingState {
  phase: ShadowingPhase
  activeIndex: number   // 当前练习的句子
  playsDone: number     // 本句已完整播放遍数
}

type ShadowingEvent =
  | { type: 'TICK'; time: number }            // rAF 每帧
  | { type: 'GAP_ELAPSED' }                   // 留白计时结束
  | { type: 'TOGGLE'; enabled: boolean }
  | { type: 'CONFIG_CHANGE'; patch: Partial<ShadowingConfig> }
  | { type: 'JUMP'; index: number }           // 用户点了别的句子

// 纯函数：(state, event, ctx) → { state, commands }
// commands 由 hook 翻译成对 audio 元素的副作用
type ShadowingCommand =
  | { type: 'SEEK'; time: number }
  | { type: 'PAUSE' }
  | { type: 'PLAY' }
  | { type: 'SET_RATE'; rate: number }
  | { type: 'START_GAP_TIMER'; ms: number }
```

`reduce(state, event, { segments, config })` 返回 `{ next, commands[] }`。这样整个引擎逻辑无副作用、可表驱动单测。

### 4.3 持久化

`ShadowingConfig` 存 `localStorage`(键如 `shadowing-config`),与现有 theme/language 偏好一致。

---

## 5. 播放控制器 `usePlaybackController`

位置:`src/hooks/player/usePlaybackController.ts`。封装 `<audio>` 的命令式控制 + transport 状态 + 练习循环。

```ts
interface PlaybackController {
  // transport（节流后的 React state，用于渲染）
  isPlaying: boolean
  currentTime: number     // ~10fps 节流，仅供进度条/时间文字
  duration: number
  playbackRate: number
  volume: number
  isMuted: boolean

  // 帧级精确读数（不触发渲染）
  currentTimeRef: React.MutableRefObject<number>

  // transport 操作
  play(): void
  pause(): void
  togglePlay(): void
  seek(time: number): void
  setPlaybackRate(rate: number): void
  setVolume(v: number): void
  toggleMute(): void

  // 句级
  activeIndex: number
  playLine(index: number): void   // 跳到句首并播放
  replayLine(): void              // 重播本句（键盘 R）

  // 影子
  shadowing: ShadowingState & { config: ShadowingConfig }
  toggleShadowing(): void
  setShadowingConfig(patch: Partial<ShadowingConfig>): void

  // 手动 A/B（控制器特例：repeat=∞, gap=0）
  loopRange: { start: number; end: number } | null
  setLoopRange(r: { start: number; end: number } | null): void
}
```

内部:
- 单条 **rAF 循环**(仅在 `isPlaying` 时运行):读 `audio.currentTime` → 写 `currentTimeRef` → 派发 `TICK` 给 FSM → 执行返回的 commands;同时以 ~10fps 节流更新 `currentTime` state。
- `<audio>` 元素仍由 `PlayerPage` 渲染并通过 `ref` 传入控制器(或控制器内部持有 ref,`PlayerPage` 只挂载元素)。**实现时统一为:`PlayerPage` 持 `audioRef`,传入控制器**,保留 SSR 友好。
- volume/mute 收敛到控制器(消除 `PlayerPage.tsx:53` 的本地 volume 双源、修复"假静音丢音量")。
- A/B 循环作为 FSM 特例,删除 `useAudioPlayer.ts:76-88` 的独立 polling 循环。

> `usePlaybackController` 取代现有 `useAudioPlayer` + `useShadowingMode`。两者实现完成后删除。

---

## 6. 共享当前句 hook

- 抽 `findActiveSegmentIndex(segments, time)` 到 **`src/lib/player/active-segment.ts`**(纯函数,二分),**加间隙就近兜底**:`time` 落在两句之间时,返回更近的一侧(默认归到"上一句刚结束"或"下一句即将开始"——取距离最近者),使高亮在静音段不闪没。
- `useActiveSegmentIndex(segments, currentTimeRef)`:基于 ref + rAF/节流给出 `activeIndex`(state)。
- `ScrollableSubtitleDisplay`、`PlayerPage`、控制器三处统一消费,删除各自的重复实现。

---

## 7. 数据修复 — 逐词时间戳

- 在 `groq-transcription-utils.ts` 新增 `distributeWordsIntoSegments(segments, words)`:对每个 segment,收集 `word.start ∈ [seg.start, seg.end)` 的词 → 设为 `seg.wordTimestamps`。
- 在 `transcribe.ts` 的 segment 分支生成 `processedSegments` 后,若 `transcriptionData.words?.length` 则调用上述函数补齐。
- postprocess 已只 `.modify` normalized/translation/furigana,不会覆盖 `wordTimestamps`(`useTranscription.ts:221-252`)。
- 修复 `ScrollableSubtitleDisplay` 振假名按数组下标对齐的脆弱逻辑:furigana 数与 word 数不等时不要错位(按词文本匹配或仅在等长时启用 ruby,否则降级为整段 furigana)。
- **删除 `Segment.romaji`**(`src/types/db/database.ts:49`)及渲染端引用(`ScrollableSubtitleDisplay.tsx:199`);无索引,无需 DB 版本迁移。

---

## 8. UI / 页脚

```
影子开启 → 弹出设置浮层：
        ┌─ 影子跟读设置 ──────────────┐
        │ 每句重复    −  3  +   (1–5)  │
        │ 跟读留白    短  [中]  长     │   ← 映射 gapRatio: 0.6 / 1.0 / 1.6
        │ 练习语速   0.5× [0.75×] 1×  │
        │ 自动进下一句        [开 ●]   │
        └─────────────────────────────┘
 0:32 ▕━━━A════════B────────────▏ 3:14     ← 当前句循环区高亮（loopRange / 当前句）
 [⟲10][▶/⏸][10⟳]  速度 0.75×|1×|1.25×  🎤影子●  第2/3遍·留白  🔊▕━━▏
```

- 速度预设(`PlaybackSpeedControl` 收割改造成预设按钮,或新写极简预设组件)接到 `setPlaybackRate`。
- **两个语速的关系(消歧义)**:页脚速度 = 通用 `playbackRate`(浏览/精听用);浮层「练习语速」= `practiceRate`,**仅在影子模式 LISTENING 阶段由 FSM 经 `SET_RATE` 覆盖生效**。即:影子开 → 听句时用 practiceRate;影子关 → 始终用页脚 playbackRate。影子退出/进入 IDLE 时把 rate 还原为页脚 playbackRate。两组预设档位刻意不同(页脚 0.75/1/1.25 偏精听微调;浮层 0.5/0.75/1 偏跟读慢速)。
- 影子开关旁显示实时状态(`第 n/N 遍 · 听/留白`)。
- 进度条标出当前句(或手动 A/B)的循环区。
- 浮层挂在 `PlayerFooterContainer`(当前是纯透传,正好做这个 seam,避免 `PlayerPage` 再加 props)。
- **接上 `PlayerStatusBanner`**:替换 `PlayerPage.tsx:293-301` 的内联文字,显示转写进度/失败(含 postprocess 失败提示)。

### 键盘快捷键(`useKeyboardControls` 接进 PlayerPage)

| 键 | 行为 |
|---|---|
| `Space` | 播放/暂停 |
| `←` / `→` | 上一句 / 下一句 |
| `R` | 重播本句 |
| `[` / `]` | 减速 / 加速(在预设档位间切换) |
| `S` | 切换影子模式 |

输入框聚焦时禁用;绑定在 `document`,卸载时解绑。

---

## 9. Build / Test 解锁(实现第一步)

### 9.1 构建
`src/styles/app.css`:把 `.card-base`(`@layer components`)改为 Tailwind v4 的 `@utility card-base { … }`,使 `@apply card-base` 可解析。校验 `bun run build` 通过。

### 9.2 测试回退 Vitest
- 新增 `vitest.config.ts`:`environment: 'happy-dom'`(已有依赖)、`setupFiles: ['./src/__tests__/setup.ts']`、`globals: true`、别名 `~`→`./src`。
- `package.json`:`test` → `vitest`,`test:run` → `vitest run`,`test:coverage` → `vitest run --coverage`(devDeps 加回 `vitest` + `@vitest/coverage-v8`)。
- 移除 `bunfig.toml` 的 `[test] preload`(避免双轨)。
- 改写 `src/__tests__/setup.ts` 为 Vitest 写法:从 `vitest` 取 `vi/expect/beforeAll`,用 happy-dom 环境(或保留手动 Window 注入,但移除 `bun:test` 引用),`vi.importActual` 恢复可用。修 `URL.createObjectURL` 的 Blob 类型。
- 修过期 fixtures:`useTranscription.test.tsx`(`vi.mocked`、缺 `postProcessStatus`、fetch-mock `preconnect`)、`useFiles.test.tsx`(`uploadedAt`/`updatedAt`)、`db-utils.test.ts`(`createdAt`/`updatedAt`)。
- 验收:`bun run type-check` 0 错;现有播放器测试全绿(作为重构安全网)。

---

## 10. 重构 / 删除

收割后删除孤儿栈:

| 文件 | 动作 |
|---|---|
| `AudioPlayer.tsx` | 删 |
| `AudioControls.tsx` | 删 |
| `VolumeControl.tsx` | 删(页脚自有音量) |
| `useAudioPlayerState.ts` | 删 |
| `useAudioPlayerTime.ts` | 删(若 `formatTime` 仍被用则迁到 `lib/utils`) |
| `PlaybackSpeedControl.tsx` | 收割 → 改造为页脚速度预设 |
| `useKeyboardControls.ts` | 收割 → 接进 PlayerPage |
| `PlayerStatusBanner.tsx` | 接上渲染 |
| `useAudioPlayer.ts` | 由 `usePlaybackController` 取代后删 |
| `useShadowingMode.ts` | 由 `usePlaybackController` 取代后删 |

删除前用 grep 确认无其它引用;`formatTime` 等仍被消费的小工具迁移而非直接删。

---

## 11. 测试策略(TDD)

先写纯逻辑单测,再写副作用层:

1. **`active-segment.ts`**:正常命中、边界、句间间隙就近兜底、大数组性能。
2. **`distributeWordsIntoSegments`**:词落在段内/段边界/无词/词跨段。
3. **`shadowing-machine.ts` reducer**:LISTENING→GAP→重播→进句全链;repeatCount=1;autoAdvance=false 停在 IDLE;最后一句无下一句;运行中改 config;JUMP 重置 playsDone;手动 A/B(repeat=∞)。
4. **`usePlaybackController`**:用假 audio + fake timers 验证 commands→副作用(seek/pause/rate)。
5. **组件**:页脚速度预设、影子浮层交互、`ScrollableSubtitleDisplay` 逐词高亮(此时有数据)。

---

## 12. 受影响文件总览(供实现计划拆分)

**新增**
- `src/lib/player/active-segment.ts`(+test)
- `src/lib/player/shadowing-machine.ts`(+test)
- `src/hooks/player/usePlaybackController.ts`(+test)
- `src/hooks/player/useActiveSegmentIndex.ts`
- `src/components/features/player/ShadowingSettings.tsx`
- `vitest.config.ts`

**修改**
- `src/styles/app.css`(card-base)
- `src/routes/api/transcribe.ts` + `src/lib/ai/groq-transcription-utils.ts`(词分配)
- `src/components/features/player/PlayerPage.tsx`(瘦身、接控制器、键盘、状态条)
- `src/components/features/player/page/PlayerFooter.tsx`(速度预设、影子状态、循环标记)
- `src/components/features/player/PlayerFooterContainer.tsx`(挂浮层)
- `src/components/features/player/ScrollableSubtitleDisplay.tsx`(共享当前句、furigana 对齐)
- `src/types/db/database.ts`(删 romaji)
- `package.json` / `bunfig.toml` / `src/__tests__/setup.ts`(Vitest 回退)
- 各过期测试 fixtures

**删除**:见 §10。

---

## 13. 风险与缓解

- **回退测试运行器触及多文件** → 作为实现第一阶段单独完成并"先绿",再动引擎。
- **rAF × `audio.currentTime` 精度** → 标准做法,跨浏览器可靠;`ε` 留余量。
- **A/B 与影子合并** → A/B = FSM 特例(repeat=∞、gap=0),保留手动区间循环能力。
- **furigana 对齐** → 数量不等时降级,不强行按下标对齐。

---

## 14. 实现顺序(建议)

1. **解 blocker**:card-base 修复 + Vitest 回退(type-check 0 错、旧测试全绿)。
2. **快赢**:慢速预设 UI(引擎已支持)+ 逐词时间戳修复(UI 已写好)。
3. **引擎**:`active-segment` → `shadowing-machine` → `usePlaybackController`(全程 TDD)。
4. **接入**:PlayerPage 换控制器、页脚/浮层/循环标记、键盘、状态条;删孤儿栈。
5. **收尾**:回归测试、`bun run build` 通过、手动验证影子练习全链。
