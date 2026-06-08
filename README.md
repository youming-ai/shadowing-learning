# Shadowing Learning

<div align="center">

**面向语言学习者的影子跟读练习应用 / AI-powered shadowing practice for language learners**

[![Bun](https://img.shields.io/badge/Bun-1.2-000000.svg?logo=bun)](https://bun.sh/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg?logo=vite)](https://vite.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack%20Start-1.x-ef4444.svg)](https://tanstack.com/start)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Biome](https://img.shields.io/badge/Biome-2-60a5fa.svg?logo=biome)](https://biomejs.dev/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[架构](./docs/ARCHITECTURE.md) · [开发](./docs/DEVELOPMENT.md) · [数据流](./docs/DATA-FLOW.md) · [部署](./docs/DOKPLOY.md) · [Git 流程](./docs/GIT-WORKFLOW.md)

</div>

---

## 这是什么

[影子跟读（Shadowing）](https://en.wikipedia.org/wiki/Shadowing_(psycholinguistics)) 是一种通过紧跟原音模仿来训练听说能力的语言学习方法。本项目是一个 Web 应用：

1. **上传**一段音频（MP3 / WAV / M4A / FLAC）
2. **自动转录**为时间戳字幕（Groq Whisper-large-v3-turbo）
3. **后处理**生成规范化文本、翻译和标注（Groq LLM）
4. **同步播放**：字幕随音频高亮，支持逐句循环、可调速度，专注跟读练习

支持中文（简/繁）、英语、日语、韩语，UI 与转录语言可独立切换。

## 特性

- **客户端优先**：除两次 Groq API 调用外，所有数据（音频 Blob、转录、片段）都存放在浏览器的 IndexedDB（Dexie），无后端数据库
- **多语言**：UI 与翻译目标支持 5 种语言，使用 BCP-47 hreflang 声明
- **PWA**：可安装、支持离线降级（Service Worker 注册）
- **主题系统**：浅色 / 深色 / 跟随系统 / 高对比度，CSS 变量驱动
- **性能监控**：内置 Web Vitals 上报（可选 token 保护）
- **类型安全**：严格 TypeScript + Zod 校验 API 边界
- **测试**：bun test（内置）+ happy-dom + fake-indexeddb

## 技术栈

| 类别       | 选型                                           |
| ---------- | ---------------------------------------------- |
| 运行时     | Bun ≥1.2（运行时 + 包管理器，lockfile `bun.lock`） |
| 框架       | Vite 8 + TanStack Start / TanStack Router（文件路由 + SSR） |
| 视图       | React 19, Tailwind CSS v4, Radix UI, lucide-react |
| 状态       | TanStack Query（服务态） + React Context（UI 态） |
| 持久化     | Dexie / IndexedDB（v3 schema）                  |
| AI         | Groq SDK（Whisper-large-v3-turbo + LLM 后处理） |
| 校验       | Zod                                            |
| 通知       | sonner                                         |
| 工具链     | Biome 2（lint + format）, bun test             |
| 部署       | Docker (multi-stage) + Dokploy（VPS, Traefik） |

## 架构

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ 浏览器：上传  │ ──▶ │ /api/transcribe  │ ──▶ │ Groq Whisper     │
└──────┬───────┘     │ (rate-limited)   │     └──────────────────┘
       │             └─────────────────┘
       │             ┌─────────────────┐     ┌──────────────────┐
       │         ──▶ │ /api/postprocess │ ──▶ │ Groq LLM         │
       │             └─────────────────┘     └──────────────────┘
       ▼
┌──────────────────────────────────────────┐
│ IndexedDB (Dexie)                         │
│   files / transcripts / segments          │
└──────────────────────────────────────────┘
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

### 安装

```bash
git clone https://github.com/youming-ai/shadowing-learning.git
cd shadowing-learning
bun install
cp .env.example .env.local
# 在 .env.local 中填入 GROQ_API_KEY
bun run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 环境变量

| 变量名                      | 必填 | 说明                                          |
| --------------------------- | ---- | --------------------------------------------- |
| `GROQ_API_KEY`              | ✓    | Groq Whisper + LLM 调用（服务端）             |
| `VITE_APP_URL`              |      | 站点公开 URL；客户端读取需 `VITE_` 前缀，默认 `http://localhost:3000` |
| `PERFORMANCE_ADMIN_TOKEN`   |      | 保护 `/api/performance` 上报端点              |

切勿将 `.env*` 提交到仓库。

## 脚本

```bash
# 开发
bun run dev            # 开发服务器（http://localhost:3000）
bun run build          # 生产构建 → dist/（含 dist/server/server.js）
bun run start          # 启动构建产物（bun run dist/server/server.js）
bun run preview        # 预览生产构建
bun run clean          # 清理 .output / dist / 缓存

# 质量
bun run lint           # Biome check
bun run format         # Biome format --write
bun run type-check     # tsc --noEmit

# 测试（Bun 内置 runner）
bun test               # 单次执行（监视模式加 --watch）
bun test --coverage    # 覆盖率
bun test path/to/file.test.ts   # 单文件
bun test -t "test name pattern" # 按名称匹配单用例
```

## 项目结构

```
src/
├── routes/                    # TanStack Router 文件路由
│   ├── __root.tsx             # 根布局 + head（meta / JSON-LD / PWA）+ Provider 栈
│   ├── index.tsx              # 首页
│   ├── player.$fileId.tsx     # 播放器页面
│   ├── settings.tsx           # 设置
│   ├── account.tsx            # 账户
│   └── api/                   # TanStack Start 服务端 handler
│       └── transcribe / postprocess / health / performance
├── router.tsx                 # createRouter（getRouter）
├── routeTree.gen.ts           # 自动生成的路由树（勿手改）
├── components/
│   ├── ui/                    # 基础组件（Radix 包装 + sonner）
│   ├── features/              # file / player / settings 业务模块
│   ├── layout/                # 布局 + Context（Theme / I18n / TranscriptionLanguage）+ Providers
│   └── transcription/
├── hooks/
│   ├── api/                   # 服务态（含 transcriptionKeys 工厂）
│   ├── db/                    # IndexedDB 读写
│   ├── player/                # 播放器状态
│   └── ui/
├── lib/
│   ├── ai/                    # Groq 封装与转录工具
│   ├── db/                    # Dexie schema 与 DBUtils
│   ├── i18n/                  # 多语种翻译字典
│   ├── utils/                 # api-response / rate-limiter / error-handler 等
│   └── config/
├── styles/app.css             # Tailwind v4 + CSS 变量主题（@theme 块）
├── types/                     # api / db / ui 类型
└── __tests__/setup.ts         # 测试全局 setup（happy-dom / fake-indexeddb，经 bunfig.toml 预加载）
```

## 部署

项目部署在 VPS 的 Docker 容器中，由 [Dokploy](https://dokploy.com/) 通过 Traefik 反向代理（**不在 Vercel 上**）。

```bash
# 本地容器冒烟测试
docker compose up --build
```

- [Dockerfile](./Dockerfile) 多阶段构建于 `oven/bun:1-alpine`，产物为 `dist/`，以 `bun run dist/server/server.js` 启动
- [docker-compose.yml](./docker-compose.yml) 用 `expose: 3000` 而非 `ports:`，由 Dokploy 接入 Traefik 网络
- 完整流程见 [docs/DOKPLOY.md](./docs/DOKPLOY.md)

> 速率限制器是进程内内存实现，单实例可用，多副本扩容前需替换为 Redis 等共享存储。

## 测试

- 运行器：Bun 内置 `bun test`（测试代码用 Vitest 风格的 `vi.*`，由 `bun:test` 提供该 API）
- 环境：happy-dom + `fake-indexeddb`
- 测试与源代码就近（`__tests__/` 子目录）
- 全局 setup：[`src/__tests__/setup.ts`](./src/__tests__/setup.ts)，经 `bunfig.toml` 的 `[test] preload` 预加载（含 happy-dom 全局、jest-dom 匹配器、router/sonner mock）

```bash
bun test                 # 全量
bun test --coverage      # 覆盖率
```

## SEO

- 文档 head 由 TanStack Start 在 [`src/routes/__root.tsx`](./src/routes/__root.tsx) 的 `head()` 集中管理：title / description / OG / Twitter 卡片
- `SoftwareApplication` + `WebSite` JSON-LD
- `robots.txt` 与 `sitemap.xml` 为 [`public/`](./public/) 下的静态文件
- PWA：`manifest.json` + Service Worker 注册

## 贡献

1. Fork & 新建分支：`git checkout -b feat/your-feature`
2. 修改后跑通：`bun run lint && bun run type-check && bun test`
3. 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 提交信息
4. 推送并开 PR（参考 [docs/GIT-WORKFLOW.md](./docs/GIT-WORKFLOW.md)）

详细约定见 [CLAUDE.md](./CLAUDE.md)。

## 许可证

[MIT](./LICENSE)

## 致谢

[Bun](https://bun.sh/) · [Vite](https://vite.dev/) · [TanStack Start](https://tanstack.com/start) · [React](https://react.dev/) · [Radix UI](https://www.radix-ui.com/) · [Tailwind CSS](https://tailwindcss.com/) · [Dexie](https://dexie.org/) · [TanStack Query](https://tanstack.com/query) · [Groq](https://groq.com/) · [Biome](https://biomejs.dev/)

---

<div align="center">

如果项目对你有帮助，欢迎 Star ⭐

[Issue](https://github.com/youming-ai/shadowing-learning/issues) · [Discussions](https://github.com/youming-ai/shadowing-learning/discussions)

</div>
