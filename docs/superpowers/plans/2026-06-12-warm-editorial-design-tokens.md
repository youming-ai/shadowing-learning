# Warm Editorial 设计令牌 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 app 的视觉语言从「中性绿」重塑为 **Warm Editorial**（赤陶珊瑚强调 + 暖中性 + 拉丁衬线标题），只改设计令牌取值，不动组件结构。

**Architecture:** 所有 UI 颜色/圆角/字体都走 `src/styles/app.css` 里按 `data-theme` 切换的 CSS 变量。本计划改三套主题块（dark / light / high-contrast）的**令牌取值**、新增 `--font-heading` 并应用到标题、收敛圆角。绝大部分组件零改动；唯一组件触碰是给两处非 `<h>` 标题元素加 `font-heading` class（spec 第 7 节已纳入）。

**Tech Stack:** Tailwind v4（CSS-only `@theme`）、CSS 自定义属性 + `data-theme` 主题、Vitest。

## Global Constraints

- 包管理只用 `bun`。测试一律 `bun run test:run` / `bunx vitest run <path>`，**绝不用 `bun test`**。
- 改完跑 `bun run lint`（Biome，0 error）、`bun run type-check`、`bun run build`（确保 CSS 编译）、`bun run test:run`（CSS 改动不应破坏任何测试）。
- 规格源：[docs/superpowers/specs/2026-06-12-warm-editorial-design-tokens.md](../specs/2026-06-12-warm-editorial-design-tokens.md)。所有 hex/取值以 spec 为准。
- 可访问性：每套主题正文/次级文字 × 背景 ≥ WCAG AA（4.5:1）；high-contrast 套 ≥ AAA（7:1）。
- 现有四主题机制（`:root, html[data-theme="dark"]` / `light` / `high-contrast`）、ThemeDebugger（Ctrl/Cmd+Shift+T）、令牌**名称**保持不变——只换取值。
- 赤陶珊瑚色阶（贯穿全计划）：`50 #FBF1EC · 100 #F6DFD3 · 200 #EFC2AC · 300 #E89F7E · 400 #E47E54 · 500 #E0653C · 600 #C44E29 · 700 #A03D20 · 800 #7C301A · 900 #5A2413`。
- 语义色基准：success `#3E8E5F` · warning `#C9912B` · error `#C0392B` · info `#3E6E8E`。**关键：现有 `--color-success`/`--color-info` 别名指向 `var(--brand-500)`，brand 变珊瑚后必须显式改成上述绿/蓝，否则成功/信息态会变成珊瑚色。**
- 分支 `feat/shadowing`，每任务结束 commit；改 CSS 后 `bunx @biomejs/biome check --write src/styles/app.css`。

---

### Task 1: 标题衬线字体 + 圆角收敛（主题无关地基）

**Files:**
- Modify: `src/styles/app.css`（`@theme` 块 ~1-82；`@layer base` ~116 起；dark 块 radius ~242-244；light 块 radius ~447-449）

**Interfaces:**
- Produces: 新令牌 `--font-heading`（Tailwind 同时生成 `font-heading` 工具类，供 Task 5 用）；`h1,h2,h3` 全局套衬线；`--radius-card`=8px / `--radius-card-large`=12px / `--radius-control`=6px。

- [ ] **Step 1: `@theme` 块加字体令牌**

在 `@theme {` 块内（`--shadow-theme-xl` 行之后、`}` 之前，约 81 行）加：
```css
  --font-heading:
    "Iowan Old Style", Palatino, Georgia, "Times New Roman", "PingFang SC",
    "Microsoft YaHei", sans-serif;
```
（Tailwind v4 下 `@theme` 里的 `--font-heading` 会自动生成 `font-heading` 工具类，同时该变量可被 `var(--font-heading)` 引用。拉丁字形命中前面的衬线族；CJK 字形这些衬线族无覆盖 → 回退到末尾系统无衬线，零 webfont。）

- [ ] **Step 2: `@layer base` 给标题套衬线**

在 `@layer base {` 块内（`* { border-color: ... }` 规则之后，约 119 行后）加：
```css
  h1,
  h2,
  h3 {
    font-family: var(--font-heading);
  }
```

- [ ] **Step 3: 收敛圆角（dark 块）**

dark 块当前（~242-244）：
```css
    --radius-card: var(--radius-2xl);
    --radius-card-large: 1.75rem;
    --radius-control: var(--radius-lg);
```
改为：
```css
    --radius-card: 0.5rem;
    --radius-card-large: 0.75rem;
    --radius-control: 0.375rem;
```

- [ ] **Step 4: 收敛圆角（light 块）**

light 块当前（~447-449）与 dark 相同三行，改成同样的 `0.5rem / 0.75rem / 0.375rem`。（high-contrast 块未定义 radius，继承 `:root`/dark 值，无需改。）

- [ ] **Step 5: 验证**

```bash
bunx @biomejs/biome check --write src/styles/app.css
bun run build 2>&1 | tail -3        # CSS 必须编译通过
bun run type-check && bun run lint
bun run dev                          # 浏览器看：页面 <h1>（如「在线发现」标题）英文/数字呈衬线、中文系统无衬线；卡片圆角明显收敛
```
Expected: build 成功；标题衬线生效；圆角变小。

- [ ] **Step 6: Commit**

```bash
git add src/styles/app.css
git commit -m "feat(theme): add --font-heading (latin serif) for headings + tighten card/control radius"
```

---

### Task 2: 暗色主题 → 暖黑 + 珊瑚

**Files:**
- Modify: `src/styles/app.css`（dark 块 `:root, html[data-theme="dark"]` ~124-359）

**Interfaces:**
- Consumes: 珊瑚色阶、语义基准（见 Global Constraints）。
- Produces: 暗色主题全部令牌切到暖黑+珊瑚；success/info 已与 brand 解耦。

- [ ] **Step 1: 珊瑚品牌色阶**（~127-136）把 `--brand-50..900` 的绿色值替换为珊瑚色阶（见 Global Constraints 的 10 个值，一一对应 50→900）。

- [ ] **Step 2: 解耦语义 + primary**（~151-157）改为：
```css
    --color-primary: #e8743b;            /* 暖黑底上提亮的珊瑚 */
    --color-primary-hover: var(--brand-600);
    --color-primary-active: var(--brand-700);
    --color-success: #4fae79;            /* 绿，暗色调亮，独立于 brand */
    --color-info: #5b93b8;               /* 蓝灰，暗色调亮 */
    --color-warning: #d6a23a;
    --color-error: #d75549;              /* 暗色调亮的红，仍明显区别于珊瑚 */
```

- [ ] **Step 3: 状态语义令牌**（~160-178）把 success/info 的 surface/border rgba 从绿/lime 改为各自基准色的低透明度，error/warning 同步：
```css
    --state-success-text: var(--color-success);
    --state-success-surface: rgba(79, 174, 121, 0.18);
    --state-success-border: rgba(79, 174, 121, 0.45);
    --state-success-strong: #4fae79;

    --state-warning-text: var(--color-warning);
    --state-warning-surface: rgba(214, 162, 58, 0.20);
    --state-warning-border: rgba(214, 162, 58, 0.45);
    --state-warning-strong: #e6b84e;

    --state-error-text: var(--color-error);
    --state-error-surface: rgba(215, 85, 73, 0.20);
    --state-error-border: rgba(215, 85, 73, 0.48);
    --state-error-strong: #e0685c;

    --state-info-text: var(--color-info);
    --state-info-surface: rgba(91, 147, 184, 0.20);
    --state-info-border: rgba(91, 147, 184, 0.48);
    --state-info-strong: #5b93b8;
```

- [ ] **Step 4: success 色阶解耦**（~181-190）`--success-50..900` 当前指向 `var(--brand-*)`（会变珊瑚）。改为独立绿阶：
```css
    --success-50: #ecf7f0;
    --success-100: #cfe9da;
    --success-200: #a6d6ba;
    --success-300: #79c098;
    --success-400: #57ad80;
    --success-500: #3e8e5f;
    --success-600: #327a50;
    --success-700: #285f40;
    --success-800: #1f4a32;
    --success-900: #163524;
```
（`--warning-*` / `--error-*` 色阶已是独立黄/红，无需改。）

- [ ] **Step 5: 文本（暖奶油）**（~215-219）：
```css
    --text-primary: #ece2d4;
    --text-secondary: #b6a88f;
    --text-tertiary: #8a7c68;
    --text-muted: #6e614f;
    --text-inverse: #1c1814;   /* 珊瑚填充按钮上的暖黑文字 */
```

- [ ] **Step 6: 表面与边框（暖黑）**（~222-224、~276-278）：
```css
    --surface-base: #1c1814;
    --surface-card: #241e18;
    --surface-muted: #2a2219;
```
```css
    --border-default: #2e271f;
    --border-strong: #3a3127;
    --border-subtle: #271f18;
```

- [ ] **Step 7: 播放器 + 高亮（珊瑚 rgba）**（~324、~328、~330-331、~352）把所有 `rgba(132, 204, 22, …)`（lime）换成 `rgba(224, 101, 60, …)`（珊瑚 500），保留各自 alpha：
```css
    --player-highlight-bg: rgba(224, 101, 60, 0.18);
    --player-track-color: rgba(224, 101, 60, 0.25);
    --player-thumb-border: rgba(224, 101, 60, 0.6);
    --player-hover-indicator: rgba(224, 101, 60, 0.35);
    /* ... 同块内 */
    --highlight-bg: rgba(224, 101, 60, 0.18);
```

- [ ] **Step 8: 验证（暗色）**

```bash
bunx @biomejs/biome check --write src/styles/app.css
bun run build 2>&1 | tail -3 && bun run type-check && bun run lint
bun run dev   # 切到 dark（默认）：暖黑底、奶油字、珊瑚强调；成功态仍是绿、错误态深红、信息态蓝——不是珊瑚
```
Expected: 暗色整体暖黑+珊瑚；success/info/error 各自颜色正确（不被珊瑚污染）。

- [ ] **Step 9: Commit**

```bash
git add src/styles/app.css
git commit -m "feat(theme): dark theme -> warm-black + coral; decouple success/info from brand"
```

---

### Task 3: 浅色主题 → 暖米白 + 珊瑚

**Files:**
- Modify: `src/styles/app.css`（light 块 `html[data-theme="light"]` ~364-560）

**Interfaces:**
- Consumes: 珊瑚色阶、语义基准。
- Produces: 浅色主题切到暖米白+珊瑚；success/info 解耦。

- [ ] **Step 1: 珊瑚品牌色阶**（~366-375）`--brand-50..900` 替换为珊瑚 10 值（同 Task 2 Step 1）。

- [ ] **Step 2: 解耦语义 + primary**（~390-396）：
```css
    --color-primary: var(--brand-500);   /* #E0653C */
    --color-primary-hover: var(--brand-600);
    --color-primary-active: var(--brand-700);
    --color-success: #3e8e5f;
    --color-info: #3e6e8e;
    --color-warning: #c9912b;
    --color-error: #c0392b;
```

- [ ] **Step 3: 状态语义令牌**（~399-417）：
```css
    --state-success-text: var(--color-success);
    --state-success-surface: rgba(62, 142, 95, 0.10);
    --state-success-border: rgba(62, 142, 95, 0.30);
    --state-success-strong: #327a50;

    --state-warning-text: var(--color-warning);
    --state-warning-surface: rgba(201, 145, 43, 0.12);
    --state-warning-border: rgba(201, 145, 43, 0.32);
    --state-warning-strong: #a9781f;

    --state-error-text: var(--color-error);
    --state-error-surface: rgba(192, 57, 43, 0.10);
    --state-error-border: rgba(192, 57, 43, 0.30);
    --state-error-strong: #a32d22;

    --state-info-text: var(--color-info);
    --state-info-surface: rgba(62, 110, 142, 0.10);
    --state-info-border: rgba(62, 110, 142, 0.30);
    --state-info-strong: #335c77;
```

- [ ] **Step 4: 文本（暖深棕）**（~420-424）：
```css
    --text-primary: #2b2520;
    --text-secondary: #6b5f4f;
    --text-tertiary: #9c8e76;
    --text-muted: #b5a892;
    --text-inverse: #ffffff;   /* 珊瑚按钮上的白字（粗体按钮文字，对比可接受） */
```

- [ ] **Step 5: 表面与边框（暖米白）**（~427-429、~481-483）：
```css
    --surface-base: #fbf7f0;
    --surface-card: #fffdf9;
    --surface-muted: #f0e7d8;
```
```css
    --border-default: #e6dcc9;
    --border-strong: #d8cbb2;
    --border-subtle: #efe7d8;
```

- [ ] **Step 6: 播放器 + 高亮 + 上传背景（珊瑚 rgba）**（~525、~529、~531-532、~549、~553）把 `rgba(34, 197, 94, …)`（绿）换成 `rgba(224, 101, 60, …)`：
```css
    --player-highlight-bg: rgba(224, 101, 60, 0.10);
    --player-track-color: rgba(224, 101, 60, 0.20);
    --player-thumb-border: rgba(224, 101, 60, 0.55);
    --player-hover-indicator: rgba(224, 101, 60, 0.30);
    /* 同块内 */
    --upload-bg-color: rgba(224, 101, 60, 0.05);
    --highlight-bg: rgba(224, 101, 60, 0.10);
```

- [ ] **Step 7: 验证（浅色）**

```bash
bunx @biomejs/biome check --write src/styles/app.css
bun run build 2>&1 | tail -3 && bun run type-check && bun run lint
bun run dev   # ThemeDebugger 切到 light：暖米白底、深棕字、珊瑚强调、收敛圆角；成功绿/错误红/信息蓝正确
```
Expected: 浅色暖米白+珊瑚；卡片 `#FFFDF9` 与底 `#FBF7F0` 有层次。

- [ ] **Step 8: Commit**

```bash
git add src/styles/app.css
git commit -m "feat(theme): light theme -> warm off-white + coral; decouple success/info from brand"
```

---

### Task 4: 高对比主题 → 暖亮高对比 + 珊瑚

**Files:**
- Modify: `src/styles/app.css`（high-contrast 块 `html[data-theme="high-contrast"]` ~565-633）

**Interfaces:**
- Consumes: 珊瑚色阶。
- Produces: high-contrast 切到 spec 第 5 节的暖亮高对比（**注意：从当前的黑底翻成米白底**，spec 已确认）。

- [ ] **Step 1: 品牌（高对比珊瑚）**（~567-569）：
```css
    --brand-500: #a03d20;   /* 700 档，白底上对比更高 */
    --brand-600: #7c301a;
    --brand-700: #5a2413;
```

- [ ] **Step 2: 文本（暖近黑）**（~572-576）：
```css
    --text-primary: #161009;
    --text-secondary: #3a3024;
    --text-tertiary: #5a4d3a;
    --text-muted: #6e614f;
    --text-inverse: #fffefa;
```

- [ ] **Step 3: 背景（暖米白）+ 边框**（~579-587）：
```css
    --surface-base: #fffefa;
    --surface-card: #fffefa;
    --surface-muted: #f3ead8;
```
```css
    --border-default: #c9b89c;
    --border-strong: #8a7c68;
    --border-focus: #a03d20;
    --border-error: #b3261e;
```

- [ ] **Step 4: 高对比状态色**（~590-593）暖化但保高对比：
```css
    --state-success-text: #1f5f3a;
    --state-warning-text: #8a5a00;
    --state-error-text: #b3261e;
    --state-info-text: #1f5577;
```
并把 `--color-primary` / `--player-accent-color`（~629-630）确认为 `var(--brand-500)`（现已是，无需改）。

- [ ] **Step 5: 验证（高对比，AAA）**

```bash
bunx @biomejs/biome check --write src/styles/app.css
bun run build 2>&1 | tail -3 && bun run type-check && bun run lint
bun run dev   # ThemeDebugger 切到 high-contrast：暖米白底 + 近黑字（极高对比）、珊瑚 #A03D20 强调
```
Expected: 高对比为暖亮主题；正文/背景对比 ≥ 7:1（`#161009` on `#FFFEFA` ≈ 19:1）。

- [ ] **Step 6: Commit**

```bash
git add src/styles/app.css
git commit -m "feat(theme): high-contrast -> warm light AAA + coral accent"
```

---

### Task 5: 标题字体落到卡片/当前句 + 全主题终验

**Files:**
- Modify: `src/components/features/library/MediaCard.tsx`（标题 `<p>`）
- Modify: `src/components/features/watch/CurrentSentence.tsx`（原文大字 `<p>`）

**Interfaces:**
- Consumes: Task 1 的 `font-heading` 工具类。
- Produces: 视频标题/当前句原文呈拉丁衬线（编辑感落到内容标题）。

- [ ] **Step 1: MediaCard 标题加 `font-heading`**

`src/components/features/library/MediaCard.tsx` 里标题那行（`<p className="line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">{media.title}</p>`）的 className 加上 `font-heading`：
```tsx
        <p className="line-clamp-2 font-heading text-sm font-semibold text-[var(--text-primary)]">
          {media.title}
        </p>
```

- [ ] **Step 2: CurrentSentence 原文加 `font-heading`**

`src/components/features/watch/CurrentSentence.tsx:15` 当前：
```tsx
      <p className="text-xl font-bold leading-relaxed text-[var(--text-primary)] sm:text-2xl">
```
改为：
```tsx
      <p className="font-heading text-xl font-bold leading-relaxed text-[var(--text-primary)] sm:text-2xl">
```
（仅原文那行加 `font-heading`；下一行翻译 `<p>` 保持无衬线不动。）

- [ ] **Step 3: 验证 + 全主题终验**

```bash
bunx @biomejs/biome check --write src/components/features/library/MediaCard.tsx src/components/features/watch/CurrentSentence.tsx
bun run type-check && bun run lint && bun run test:run
```
Expected: 全绿（组件改动仅加 class，测试不受影响）。

然后 `bun run dev`，用 ThemeDebugger（Ctrl/Cmd+Shift+T）逐一过 **dark / light / system / high-contrast**，每套核对：
- 资料库卡片网格、watch 三区页、设置页观感一致、无错色（success 绿 / error 红 / info 蓝，强调珊瑚）。
- 卡片视频标题与 watch 当前句原文：英文/数字呈衬线，中文系统无衬线、无方框缺字。
- 圆角收敛（8/12/6）。
- 对比度抽查（可用浏览器 devtools 的对比度提示，或下列一次性脚本核对关键配对）：
```bash
node -e '
const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const R=(a,b)=>{const x=L(a)+.05,y=L(b)+.05;return (Math.max(x,y)/Math.min(x,y)).toFixed(2)};
console.log("light 正文",R("#2b2520","#fbf7f0"));      // 应 ≥ 4.5
console.log("dark 正文",R("#ece2d4","#1c1814"));        // 应 ≥ 4.5
console.log("HC 正文",R("#161009","#fffefa"));          // 应 ≥ 7
console.log("light 珊瑚按钮白字",R("#ffffff","#e0653c")); // 记录值（粗体按钮，≥3 可接受）
'
```

- [ ] **Step 4: Commit**

```bash
git add src/components/features/library/MediaCard.tsx src/components/features/watch/CurrentSentence.tsx
git commit -m "feat(ui): apply heading serif to media-card titles and current-sentence original"
```

---

## 最终验收（DoD）

- [ ] `bun run lint && bun run type-check && bun run build && bun run test:run` 全绿。
- [ ] 四套主题（dark/light/system/high-contrast）ThemeDebugger 逐一核对：暖调 + 珊瑚强调一致；success/warning/error/info 各自颜色正确（未被珊瑚污染）。
- [ ] 标题衬线在卡片标题、页面 `<h1>`、watch 当前句生效；中文回退正常。
- [ ] 对比度：三套 ≥ AA，high-contrast ≥ AAA（脚本/ devtools 验证）。
- [ ] high-contrast 已是暖亮主题（米白底 + 近黑字）——确认这是预期变更（spec 第 5 节）。

## 与 spec 的已知偏离

- spec 第 2/3 节的暗/亮 primary 取值：light primary = `#E0653C`（brand-500）；dark primary 用 `#E8743B`（直接值，比 brand-500 亮，暖黑底上更清晰）——与 spec 一致。
- 暗色语义基准在 spec 绿/蓝/黄/红基础上各自「调亮一档」以适配暗底可读性（success `#4FAE79`、info `#5B93B8`、warning `#D6A23A`、error `#D75549`），色相不变。
- `--neutral-*` 冷灰阶**不改**（基本不直接驱动可见 UI，可见面由 `--surface-*`/`--text-*`/`--border-*` 控制，已暖化）；如终验发现某处漏网冷灰，再针对性补。
