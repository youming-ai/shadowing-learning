# Warm Editorial 设计语言 / Design Token 重塑 — 设计文档

- 日期：2026-06-12
- 状态：方向已通过视觉伴侣确认，待 spec 复核
- 目标：把 app 从「中性默认」视觉升级为有识别度的 **Warm Editorial（暖调编辑感）** 设计语言——对标 Trancy 的清晰度，但用自己的暖色板 + 衬线标题建立身份。

## 决策（视觉伴侣确认）

1. **方向 = Warm Editorial**：米白底、赤陶珊瑚强调色、衬线标题、收敛圆角、偏紧凑的「精致读物」气质。
2. **暗色 = 暖黑**：暖黑底 + 奶油文字，延续编辑感的纸感温度（非冷中性黑）。
3. **标题字体 = 拉丁衬线 + 中文系统无衬线**（option ①）：零额外字体加载，编辑感落在西文标题/数字（视频标题、时长、品牌名），中文走系统字。

## 关键架构原则（决定了改动面）

现有组件**全部消费 CSS 变量**（`var(--text-primary)` / `var(--color-primary)` / `var(--radius-card)` …），主题通过 `data-theme` 切换变量取值。因此本次重塑**只改 `src/styles/app.css` 里各主题的变量取值** + 新增 `--font-heading` 并应用到标题 + 调 `--radius-*`。**组件、hooks、逻辑、测试零改动。** 现有四套主题（dark / light / system / high-contrast）与 ThemeDebugger 机制保留。

---

## Section 1：强调色 — 赤陶珊瑚色阶

锚点 `#E0653C`（= 500）。映射到 `--brand-50 … --brand-900`：

| 档 | 值 | | 档 | 值 |
|---|---|---|---|---|
| 50 | `#FBF1EC` | | 500 | `#E0653C` |
| 100 | `#F6DFD3` | | 600 | `#C44E29` |
| 200 | `#EFC2AC` | | 700 | `#A03D20` |
| 300 | `#E89F7E` | | 800 | `#7C301A` |
| 400 | `#E47E54` | | 900 | `#5A2413` |

- `--color-primary`：亮色 = `#E0653C`（500）；暗色 = `#E8743B`（暖黑底上提亮以保对比）。
- `--color-primary-hover` = 600 `#C44E29`；`--color-primary-active` = 700 `#A03D20`。
- `--border-focus` = primary。

## Section 2：亮色主题（暖中性，微棕调）

| token | 值 |
|---|---|
| `--bg-primary` | `#FBF7F0` |
| `--bg-secondary` | `#F5EEE2` |
| `--bg-surface` / `--surface-card` | `#FFFDF9` |
| `--surface-muted` | `#F0E7D8` |
| `--surface-base` | `#FBF7F0` |
| `--text-primary` | `#2B2520` |
| `--text-secondary` | `#6B5F4F` |
| `--text-tertiary` | `#9C8E76` |
| `--text-muted` | `#B5A892` |
| `--border-primary` | `#E6DCC9` |
| `--border-secondary` | `#EFE7D8` |
| `--border-muted` | `#F0E9DC` |

## Section 3：暗色主题（暖黑）

| token | 值 |
|---|---|
| `--bg-primary` / `--surface-base` | `#1C1814` |
| `--bg-secondary` | `#161310` |
| `--bg-surface` / `--surface-card` | `#241E18` |
| `--surface-muted` | `#2A2219` |
| `--text-primary` | `#ECE2D4` |
| `--text-secondary` | `#B6A88F` |
| `--text-tertiary` | `#8A7C68` |
| `--text-muted` | `#6E614F` |
| `--border-primary` | `#2E271F` |
| `--border-secondary` | `#3A3127` |
| `--border-muted` | `#271F18` |
| `--color-primary` | `#E8743B` |

## Section 4：System 主题

`system` 主题跟随 OS 偏好，复用 Section 2（亮）/ Section 3（暗）的取值——实现上沿用现有 system 主题的媒体查询机制，只替换其引用的变量值，无新增逻辑。

## Section 5：高对比主题（保暖色相，推到 AA+/AAA）

| token | 值 |
|---|---|
| `--bg-primary` / `--surface-card` | `#FFFEFA` |
| `--text-primary` | `#161009` |
| `--text-secondary` | `#3A3024` |
| `--border-primary` | `#C9B89C` |
| `--color-primary` | `#A03D20`（700，对白底对比度更高） |

文字/背景对比度目标：高对比套 ≥ WCAG AAA（正文 7:1）；其余三套 ≥ AA（4.5:1）。实现时逐组校验，不达标就在该主题内微调该 token（保持色相、调明度）。

## Section 6：语义色（暖化但保功能可读，error 与珊瑚拉开）

沿用现有 `state-{success,warning,error,info}-{text,surface,border,strong}` 四档结构。基准色（亮色 text 档，暗色相应调亮、surface 调暗）：

| 语义 | text 基准 | 说明 |
|---|---|---|
| success | `#3E8E5F` | 暖绿 |
| warning | `#C9912B` | 琥珀，与珊瑚同暖系但更黄、可区分 |
| error | `#C0392B` | 深红，刻意比珊瑚更红更暗，避免和 primary 混淆 |
| info | `#3E6E8E` | 蓝灰，提供冷色锚点 |

surface/border/strong 档按各 text 基准在对应主题下推导（亮色：浅染背景 + 中明边框；暗色：低明度染色背景 + 中高明度文字）。

## Section 7：字体

- 新增 `--font-heading`：`'Iowan Old Style', Palatino, Georgia, 'Times New Roman', 'PingFang SC', 'Microsoft YaHei', sans-serif`
  - 拉丁字形命中前面的衬线族；中日韩字形这些衬线族无覆盖 → 浏览器回退到末尾的系统无衬线（`PingFang SC` 等）。即「英文衬线、中文无衬线」，零 webfont 下载。
- 应用：在 `@theme` 暴露 `--font-heading`，并在 base 层给标题套用：`h1, h2, h3 { font-family: var(--font-heading); }`，以及卡片/区块标题类（如 MediaCard 标题、页面 `<h1>`）。正文/控件沿用现有 `--font-sans`。
- 数字（时长、计数）随其所在文本的字体；纯数字 badge 若想要衬线数字可单独套 `--font-heading`，本期不强制。

## Section 8：圆角（收敛）

| token | 值 |
|---|---|
| `--radius-control` | `6px` |
| `--radius-card` | `8px` |
| `--radius-card-lg` | `12px` |

（现有组件用 `rounded-*` Tailwind 类的地方不动；改 token 影响的是消费 `var(--radius-*)` 的样式。Pills/badge 仍可用 `rounded-full`。）

## Section 9：播放器 token

`--player-accent-color` / `--player-highlight-bg` / `--player-track-color` / `--player-thumb-fill` 等映射到珊瑚体系：accent = `--color-primary`，highlight 用 brand-100（亮）/ brand-900 染色（暗），进度条填充 = primary。保持现有 token 名，仅换值。

---

## 改动面

- **唯一改动文件**：`src/styles/app.css`——四套主题的变量取值（Section 1-6、9）+ 新增 `--font-heading` 并在 base 层应用到标题（Section 7）+ 调 `--radius-*`（Section 8）。
- **不改**：任何组件、hook、路由、逻辑、测试；token 架构与名称、四主题机制、ThemeDebugger。
- 阴影 `--shadow-*`：可顺手微暖（投影色掺一点棕），非必须；本期保持现值即可。

## 测试与验收（DoD）

- 视觉：`bun run dev` 下用 ThemeDebugger（Ctrl/Cmd+Shift+T）逐一过 dark / light / system / high-contrast 四套，核对资料库页（卡片网格）、watch 三区页、设置页的观感与一致性。
- 可访问性：每套主题对正文/次级文字 × 背景做对比度校验（AA；高对比套 AAA）；不达标在该主题内微调。
- 回归：`bun run lint && bun run type-check && bun run test:run` 全绿（CSS 改动不应影响任何测试；无 CSS 单测——不 meaningful）。
- 字体回退：在未安装 Iowan/Palatino 的环境（如 Linux/部分 Windows）确认拉丁标题回退到 Georgia/Times 仍是衬线、中文回退到系统无衬线，无方框/缺字。

## 不做

- 不引入任何 webfont / CJK 衬线（option ① 的全部价值就在零加载）。
- 不改组件结构、间距系统（密度感主要由暖色板 + 圆角 + 标题字体承载；真正的 spacing-scale 改动需动组件，留作后续）。
- 不做动效/过渡系统重构。
- 不碰商业化/功能，纯视觉语言层。
