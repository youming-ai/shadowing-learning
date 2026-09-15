# 设计语言：「节拍」(Rhythm)

> 本文档是本项目视觉与交互决策的唯一出处。新增组件前先读这里；要偏离既有 token 时，先改这里再改代码。

## 1. 为什么是「节拍」

产品只做一件事：**听 → 跟读 → 录 → 对比**。所以视觉主语不是"内容库"或"课程"，而是两样东西：

1. **当前句**（`beat`）—— 随播放推进的、有呼吸感的焦点；
2. **用户自己的声音**（`voice`）—— 录音与回放，是本产品区别于"字幕阅读器"的核心。

这两样各自有一个专属语义色，贯穿全应用。这就是我们区别于 Trancy 的地方：它的反馈止于"带颜色分档的分数"（灰色 / <50 红 / <80 橙 / ≥80 绿），我们把**句子的节拍**和**你的声音**变成可见、可对比的对象。

### 与多邻国的关系

起点是多邻国的：**圆润、厚底可按压、鼓励性而非审判性的反馈**。我们保留这三点，但换掉它的身份：

| | 多邻国 | 我们 |
|---|---|---|
| 情绪 | 游戏化、连胜、卡通吉祥物 | 专注练习、节拍感 |
| 绿色 | 品牌本身 | 表示"当前句 / 进度"，不是品牌色 |
| 反馈 | 对 / 错 | 原声 vs 我的，可对比 |
| 布局密度 | 手机单列大按钮 | 播放器 + 字幕双栏，桌面优先 |

**不做**：连胜、XP、等级、吉祥物、彩带。这些会让"专注练习"变成"打卡"。

## 2. Token 层

三层，从下往上：

```
主题块（:root / html[data-theme=…]）   具体颜色值，四套主题
        ↓
@theme {}                              Tailwind v4 工具类来源；必须是 --color-* / --font-* 前缀
        ↓
组件（.btn-*、tsx 里的类名）            只消费语义名，不写具体色值
```

### 2.1 坑：Tailwind v4 只认 `@theme` 里的前缀

**已在主题块定义的变量，如果不在 `@theme` 里以 `--color-*` 再映射一次，Tailwind 不会生成对应工具类。** 类名不会报错，只是**静默失效**（构建产物里 0 条规则）。

`app.css` 里那组 `--foreground` / `--card` / `--ring` 就是这种情况——它们为 shadcn 原语而写，却因为缺 `--color-` 前缀，导致 `components/ui/` 下 23 个类名（`bg-card`、`text-muted-foreground`、`ring-ring`…）长期没有样式。现已全部在 `@theme` 中补齐。

> **验证方法**（改完 token 一定要跑）：
> ```bash
> bun run build
> CSS=$(ls -t dist/assets/*.css | head -1)
> grep -cE '\.bg-card([^a-zA-Z0-9_-]|$)' "$CSS"   # 必须是 1，不能是 0
> ```

### 2.2 语义色

| Token | 含义 | 用在哪 |
|---|---|---|
| `--rhythm-beat` | 当前句 / 拍点 | 活跃字幕行、卡拉OK当前词、间隔提示 |
| `--rhythm-beat-soft` | 拍点的呼吸底色 | 活跃行背景 |
| `--rhythm-voice` | 我的声音 | 录音中、回放我的录音 |
| `--rhythm-voice-soft` | 声音的底色 | 录音中按钮背景 |
| `--color-primary` | 主行动 | 主要按钮、链接 |
| `--color-error` | 出错 | 错误文案（**不要**用 voice 色表示错误） |

### 2.3 几何常量

按压反馈的深度是几何量、与主题无关，因此只在 `:root` 定义一次：

| Token | 值 | 用途 |
|---|---|---|
| `--press-depth` | `4px` | 厚底描边高度 |
| `--press-depth-active` | `1px` | 按下时收窄 |
| `--press-lift-hover` | `-1px` | 悬停微微抬起 |
| `--press-lift-active` | `3px` | 按下下沉 |

## 3. 交互：厚底可按压

所有按钮变体共享**同一条**几何规则（`.btn-base, .btn-primary, .btn-secondary, .btn-outline, .btn-ghost, .btn-danger`），变体只声明颜色。**新增变体请加进这个选择器列表，不要复制几何。**

按压 = 底部实心描边 + `:active` 下沉 + 描边收窄。这样"按下去"是有物理感的，也是多邻国式鼓励感的主要来源。

动效必须尊重 `prefers-reduced-motion`：`app.css` 里已有对应 `@media` 块，去掉位移、保留颜色与阴影反馈。

## 4. 字体

- **正文与标题同族**：Inter（Google Fonts，仅 400/500/600/700）。
- **CJK 交给系统字体**：Inter 不含汉字/假名/谚文。`--font-family-sans` 的完整回退链写在 `app.css`，中英混排时字面高度接近，避免"半句跳字体"。
- `--font-heading` 是显示字体位，**当前与正文同族**，靠 `font-bold` + 更紧的字距区分。留成独立 token 是为了以后换显示字体时不必改组件。
- 图标用 Material Symbols Outlined，不要混入第二套图标字体（Trancy 同时用 MingCute 与 Remix，读起来是意外而非系统）。

## 5. 主题

四套：`dark`（默认）、`light`、`high-contrast`、`system`（跟随系统）。

`html[data-theme=…]` 的选择器比 `:root` 更具体，因此**每个主题块只需声明差异**，其余继承 `:root`（暗色）的值。新增 token 时：

1. 在 `:root` 写基准值；
2. 在 `light`、`high-contrast` 覆盖需要变化的；
3. 若该 token 要被 Tailwind 工具类消费，再到 `@theme` 加 `--color-*` 映射。

> 高对比度主题此前缺少整组 shadcn 兼容变量，已补齐——它是最后一个主题块，最容易漏。

## 6. 已清理的设计债（2025-09 收尾）

- **`src/types/ui/theme.ts`（307 行）已删除。** 它无人引用，且与现状矛盾（品牌色写成橙色 `#E0653C`，实际是绿色；`ThemeMode` 只声明 `'dark'`，实际有 4 套）。手工维护一份 CSS 变量的 TS 镜像必然漂移——CSS 才是唯一出处，需要类型时再按实际消费的最小集补。
- **`.player-*` 字幕播放器组件类不是"要统一"，而是整块死代码，已删除**——连同 `@utility card-base`、`.card-*`/`.file-card`/`.upload-area`/`.stats-card`、`.text-stats-*`/`.text-file-*`、语义状态工具类 `.text-success` 系列、三个只含死 token 的响应式 media query、`.scrollable` 滚动条块。它们是音频时代与旧版播放器的残留，`app.css` 从 1908 行降到 ~1360 行。
- 随之清掉 31 个孤儿 token：`--player-*`（10 个）、`--space-player-*`、`--scrollbar-*`（5 个）、`--highlight-bg`、`--stats-text-color`、`--secondary-text-color` 等，以及 `@theme` 里 7 个 `--color-player-*` 映射。
- 青柠色 `rgba(132, 204, 22, …)` 与品牌绿不同源，已全部归一：暗色 `--state-info-*` 改用 `rgba(34, 197, 94, …)`（与浅色主题一致），`.settings-number-button:hover` 改用 `--surface-hover`。全文件 0 处青柠。

> 保留未删：`.safe-area-inset-*`（4 行，PWA 标准原语，属于"即将用到"而非漂移）；`--inactive-icon-color`（`.nav-button` 在用，3 处）。

## 7. 待办（下一步的设计债）

- 「跟读节奏 / 延迟」反馈尚未实现——这是我们的差异化能力（Trancy 无此信号且不需要云端），落地时需要新增表达"抢拍 / 合拍 / 拖拍"的 token。
- CLAUDE.md 曾引用不存在的 `src/components/ui/ThemeDebugger.tsx`（Ctrl/Cmd+Shift+T 调试浮层），该文件从未存在。若需要 token 覆盖率校验工具，按第 2.1 节的"构建后 grep"流程实现，别再引用幽灵文件。
