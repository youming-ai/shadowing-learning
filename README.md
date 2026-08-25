# Shadowing Learning

<div align="center">

**面向语言学习者的影子跟读练习应用 / AI-powered shadowing practice for language learners**

[![Bun](https://img.shields.io/badge/Bun-1.2-000000.svg?logo=bun)](https://bun.sh/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg?logo=vite)](https://vite.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020.svg?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-4-e36002.svg?logo=hono&logoColor=white)](https://hono.dev/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Biome](https://img.shields.io/badge/Biome-2-60a5fa.svg?logo=biome)](https://biomejs.dev/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[架构](./docs/ARCHITECTURE.md) · [开发](./docs/DEVELOPMENT.md) · [数据流](./docs/DATA-FLOW.md) · [Git 流程](./docs/GIT-WORKFLOW.md)

</div>

---

## 这是什么

[影子跟读（Shadowing）](https://en.wikipedia.org/wiki/Shadowing_(psycholinguistics)) 是一种通过紧跟原音模仿来训练听说能力的语言学习方法。本项目是一个 Web 应用：

1. **导入**一段音频（MP3 / WAV / M4A / FLAC）或粘贴一个 YouTube 链接
2. **获取字幕**：音频走 Groq Whisper-large-v3-turbo 转录；YouTube 优先抓取官方字幕轨
3. **后处理**生成规范化文本、翻译和标注（Groq LLM，分块增量写入）
4. **同步播放**：字幕随媒体高亮，支持逐句循环、可调速度、逐句录音对比，专注跟读练习

支持中文（简/繁）、英语、日语、韩语，UI 与转录语言可独立切换。

## 特性

- **客户端优先**：除少量服务端 API 调用（Groq 转录 / 后处理、YouTube 字幕抓取）外，所有数据（音频 Blob、字幕、片段）都存放在浏览器的 IndexedDB（Dexie），无后端数据库
- **多语言**：UI 与翻译目标支持 5 种语言，可独立切换
- **PWA**：可安装、支持离线降级（Service Worker 注册）
- **主题系统**：浅色 / 深色 / 跟随系统 / 高对比度，CSS 变量驱动
- **类型安全**：严格 TypeScript + Zod 校验 API 边界
- **测试**：Vitest + happy-dom + fake-indexeddb

## 技术栈

| 类别       | 选型                                           |
| ---------- | ---------------------------------------------- |
| 运行时     | Bun ≥1.2（运行时 + 包管理器，lockfile `bun.lock`） |
| 框架       | Vite 8 SPA + TanStack Router（文件路由，无 SSR） |
| 视图       | React 19, Tailwind CSS v4, Radix UI, lucide-react |
| 状态       | TanStack Query（服务态） + React Context（UI 态） |
| 持久化     | Dexie / IndexedDB（v4 schema：media / subtitles / segments） |
| AI         | Groq SDK（Whisper-large-v3-turbo + LLM 后处理） |
| 校验       | Zod                                            |
| 通知       | sonner                                         |
| 工具链     | Biome 2（lint + format）, Vitest               |
| 服务端     | Cloudflare Workers + Hono 4（API + 静态资源）  |
| 限流       | Cloudflare KV（`RATE_LIMIT_KV`，按 IP 滑动窗口） |
| 部署       | `wrangler deploy`（Cloudflare Workers）        |

## 架构

```
                 ┌──────────────────────────── Cloudflare Worker (Hono) ───┐
┌──────────────┐ │ ┌──────────────────┐     ┌──────────────────┐          │
│ 浏览器 SPA    │─┼▶│ /api/transcribe   │ ──▶ │ Groq Whisper     │          │
│ (React 19 +  │ │ ├──────────────────┤     ├──────────────────┤          │
│  TanStack    │─┼▶│ /api/postprocess  │ ──▶ │ Groq LLM         │          │
│  Router)     │ │ ├──────────────────┤     ├──────────────────┤          │
│              │─┼▶│ /api/youtube/*    │ ──▶ │ youtubei.js      │          │
│              │ │ ├──────────────────┤     └──────────────────┘          │
│              │◀┼─│ ASSETS (dist/)    │  ← 其余路径 SPA 回退               │
└──────┬───────┘ │ └──────────────────┘     ┌──────────────────┐          │
       │         │   rateLimit 中间件 ─────▶ │ RATE_LIMIT_KV    │          │
       │         └──────────────────────────┴──────────────────┴──────────┘
       ▼
┌──────────────────────────────────────────┐
│ IndexedDB (Dexie v4)                      │
│   media / subtitles / segments            │
└──────┬───────────────────────────────────┘
       ▼
┌──────────────────────────────────────────┐
│ TanStack Query 缓存 + 字幕同步播放器        │
└──────────────────────────────────────────┘
```

详细架构与数据流见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) 与 [docs/DATA-FLOW.md](./docs/DATA-FLOW.md)。

## 快速开始

### 环境要求

- [Bun](https://bun.sh/) ≥ 1.2.0（同时作为运行时与包管理器；**不要用 npm/pnpm/yarn/node**）
- 一个 [Groq API key](https://console.groq.com/keys)（免费层即可）
- 一个 Cloudflare 账号（`wrangler` 已作为 devDependency 安装）

### 安装

```bash
git clone https://github.com/youming-ai/shadowing-learning.git
cd shadowing-learning
bun install
echo "GROQ_API_KEY=your_key" > .dev.vars

# 终端 A：Worker（API + dist 资源）→ :8787
bun run build        # 首次必需：dist/ 未入版本库，wrangler 的 ASSETS 绑定指向它
bun run dev

# 终端 B：前端 HMR → :3000，/api 代理到 :8787
bun run dev:client
```

日常开发用 **两个终端**，浏览器打开 [http://localhost:3000](http://localhost:3000)：Vite 提供 HMR，API 交给 Worker。

只想跑 Worker（不改前端）时，打开 [http://localhost:8787](http://localhost:8787) 即可 —— 但 `wrangler dev` **不会**重新构建前端，改动 `src/` 后需重新 `bun run build`。

### 环境变量

| 变量名                      | 位置 | 必填 | 说明                                     |
| --------------------------- | ---- | ---- | ---------------------------------------- |
| `GROQ_API_KEY`              | 本地 `.dev.vars`；线上 `wrangler secret put` | ✓ | Groq Whisper + LLM 调用（Worker 内） |
| `RATE_LIMIT_KV`             | `wrangler.jsonc` 绑定 | ✓ | 限流计数用的 KV namespace |


切勿将 `.dev.vars` 或 `.env*` 提交到仓库。

## 脚本

```bash
# 开发
bun run dev            # wrangler dev：完整 Worker（API + dist 资源）→ :8787
bun run dev:client     # 仅前端 Vite → :3000，/api 代理到 :8787
bun run build          # vite build → dist/（纯客户端资源）
bun run deploy         # build + wrangler deploy
bun run clean          # 清理 dist / 缓存 / .wrangler

# 质量
bun run lint           # Biome check
bun run format         # Biome format --write
bun run type-check     # tsc --noEmit

# 测试（Vitest；不要用 bun test）
bun run test           # 监视模式
bun run test:run       # 单次执行
bun run test:coverage  # 覆盖率
```

## 项目结构

```
worker/                        # Cloudflare Worker（API + 资源分发）
├── index.ts                   # Hono app：cors → rateLimit → 路由 → ASSETS 回退
├── routes/                    # transcribe / postprocess / youtube
├── lib/                       # groq-whisper / groq-client / youtube-captions / api-response
└── middleware/                # cors / rate-limit（KV 支撑）

src/
├── routes/                    # TanStack Router 文件路由
│   ├── __root.tsx             # 根布局 + Provider 栈
│   ├── index.tsx              # 首页
│   ├── watch.$mediaId.tsx     # 观看 / 播放器页面
│   ├── me.tsx                 # 我的音频库
│   ├── settings.tsx           # 设置
│   └── account.tsx            # 账户
├── main.tsx                   # SPA 入口
├── router.tsx                 # createRouter
├── routeTree.gen.ts           # 自动生成的路由树（勿手改）
├── components/
│   ├── ui/                    # 基础组件（Radix 包装 + sonner）
│   ├── features/              # watch / player / library / file / settings 业务模块
│   └── layout/                # Context（Theme / I18n / TranscriptionLanguage）+ Providers
├── hooks/
│   ├── api/                   # useTranscription
│   ├── media/                 # useSubtitlePipeline / useMediaImport
│   ├── player/                # 播放器与跟读状态
│   └── db/                    # IndexedDB 读写
├── lib/
│   ├── db/                    # Dexie schema 与 DBUtils
│   ├── player/                # shadowing-machine / active-segment / active-word
│   ├── subtitles/             # 分块后处理
│   ├── youtube/               # error-messages
│   ├── config/                # 路由常量
│   ├── i18n/                  # 多语种翻译字典
│   └── utils/                 # error-handler / retry-utils / transcription-queue 等
├── styles/app.css             # Tailwind v4 + CSS 变量主题（@theme 块）
├── types/                     # api / db / ui 类型
└── __tests__/setup.ts         # 测试全局 setup（happy-dom / fake-indexeddb）
```

## 部署

部署目标是 **Cloudflare Workers**：同一个 Worker 既处理 `/api/*`，也通过 `ASSETS` 绑定分发 `dist/` 里的 SPA。

```bash
wrangler secret put GROQ_API_KEY   # 首次配置密钥
bun run deploy                     # build + wrangler deploy
```

> `Dockerfile`、`docker-compose.yml` 与 `docs/DOKPLOY.md` 是**历史遗留**：它们以 `bun run dist/server/server.js` 启动 TanStack Start 服务端产物，而当前构建不再生成该文件。请勿当作现行部署方式。

> 限流基于 Cloudflare KV，跨 colo 最终一致，属于成本护栏而非强一致配额。

## 测试

- 运行器：**Vitest**（[vitest.config.ts](./vitest.config.ts)）。**不要用 `bun test`** —— 它会忽略 vitest 配置并因缺少 DOM 而失败，且仓库中没有 `bunfig.toml`。
- 环境：happy-dom + `fake-indexeddb`
- 测试与源代码就近（`__tests__/` 子目录）
- 全局 setup：[`src/__tests__/setup.ts`](./src/__tests__/setup.ts)，由 `vitest.config.ts` 的 `setupFiles` 加载（含 jest-dom 匹配器、router/sonner mock）

```bash
bun run test:run         # 全量
bun run test:coverage    # 覆盖率
```

## SEO

- 文档 head 集中在 [`index.html`](./index.html)（SPA shell）：title / description / OG / Twitter 卡片
- `robots.txt` 与 `sitemap.xml` 为 [`public/`](./public/) 下的静态文件
- PWA：`manifest.json` + Service Worker 注册

## 贡献

1. Fork & 新建分支：`git checkout -b feat/your-feature`
2. 修改后跑通：`bun run lint && bun run type-check && bun run test:run`
3. 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 提交信息
4. 推送并开 PR（参考 [docs/GIT-WORKFLOW.md](./docs/GIT-WORKFLOW.md)）

详细约定见 [CLAUDE.md](./CLAUDE.md)。

## 许可证

[MIT](./LICENSE)

## 致谢

[Bun](https://bun.sh/) · [Vite](https://vite.dev/) · [Cloudflare Workers](https://workers.cloudflare.com/) · [Hono](https://hono.dev/) · [React](https://react.dev/) · [TanStack Router](https://tanstack.com/router) · [Radix UI](https://www.radix-ui.com/) · [Tailwind CSS](https://tailwindcss.com/) · [Dexie](https://dexie.org/) · [TanStack Query](https://tanstack.com/query) · [Groq](https://groq.com/) · [Biome](https://biomejs.dev/)

---

<div align="center">

如果项目对你有帮助，欢迎 Star ⭐

[Issue](https://github.com/youming-ai/shadowing-learning/issues) · [Discussions](https://github.com/youming-ai/shadowing-learning/discussions)

</div>
