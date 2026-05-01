# Shadowing Learning

<div align="center">

**面向语言学习者的影子跟读练习应用 / AI-powered shadowing practice for language learners**

[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Biome](https://img.shields.io/badge/Biome-2.3-60a5fa.svg?logo=biome)](https://biomejs.dev/)
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
- **测试**：Vitest + jsdom + fake-indexeddb（104+ 用例）

## 技术栈

| 类别       | 选型                                           |
| ---------- | ---------------------------------------------- |
| 框架       | Next.js 16（App Router, standalone 输出）      |
| 视图       | React 19, Tailwind CSS 3, Radix UI, lucide-react |
| 状态       | TanStack Query（服务态） + React Context（UI 态） |
| 持久化     | Dexie / IndexedDB（v3 schema）                  |
| AI         | Groq SDK（Whisper-large-v3-turbo + LLM 后处理） |
| 校验       | Zod                                            |
| 通知       | sonner                                         |
| 工具链     | pnpm 10, Biome 2（lint + format）, Vitest 4    |
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

- Node.js ≥ 20
- pnpm ≥ 9（lockfile 锁定 pnpm 10.22.0）
- 一个 [Groq API key](https://console.groq.com/keys)（免费层即可）

### 安装

```bash
git clone https://github.com/youming-ai/shadowing-learning.git
cd shadowing-learning
pnpm install
cp .env.example .env.local
# 在 .env.local 中填入 GROQ_API_KEY
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 环境变量

| 变量名                      | 必填 | 说明                                          |
| --------------------------- | ---- | --------------------------------------------- |
| `GROQ_API_KEY`              | ✓    | Groq Whisper + LLM 调用                       |
| `NEXT_PUBLIC_APP_URL`       |      | 站点公开 URL，影响 metadata / sitemap / robots |
| `PERFORMANCE_ADMIN_TOKEN`   |      | 保护 `/api/performance` 上报端点              |

切勿将 `.env*` 提交到仓库。

## 脚本

```bash
# 开发
pnpm dev               # 开发服务器（http://localhost:3000）
pnpm build             # 生产构建（output: standalone）
pnpm start             # 启动构建产物

# 质量
pnpm lint              # Biome check
pnpm format            # Biome format --write
pnpm type-check        # tsc --noEmit

# 测试
pnpm test              # 监视模式
pnpm test:run          # 单次执行
pnpm test:coverage     # v8 覆盖率报告

# 单文件 / 单用例
pnpm test:run path/to/file.test.ts
pnpm test:run -t "test name pattern"
```

## 项目结构

```
src/
├── app/                       # Next.js App Router
│   ├── api/                   # transcribe / postprocess / health / performance
│   ├── player/[fileId]/       # 播放器页面（client component + layout 元数据）
│   ├── settings/              # 设置（noindex）
│   ├── account/               # 账户（noindex）
│   ├── layout.tsx             # 根布局 + metadata + JSON-LD
│   ├── opengraph-image.tsx    # 自动生成 1200×630 OG 图
│   ├── sitemap.ts / robots.ts # SEO
│   └── page.tsx
├── components/
│   ├── ui/                    # 基础组件（Radix 包装 + sonner）
│   ├── features/              # file / player / settings 业务模块
│   ├── layout/                # 布局 + Context（Theme / I18n / TranscriptionLanguage）
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
├── styles/globals.css         # CSS 变量主题
├── types/                     # api / db / ui 类型
└── __tests__/setup.ts         # Vitest 全局 setup（fake-indexeddb 等）
```

## 部署

项目部署在 VPS 的 Docker 容器中，由 [Dokploy](https://dokploy.com/) 通过 Traefik 反向代理（**不在 Vercel 上**）。

```bash
# 本地容器冒烟测试
docker compose up --build
```

- [Dockerfile](./Dockerfile) 多阶段构建于 `node:22-alpine`，产物为 `.next/standalone`
- [docker-compose.yml](./docker-compose.yml) 用 `expose: 3000` 而非 `ports:`，由 Dokploy 接入 Traefik 网络
- 完整流程见 [docs/DOKPLOY.md](./docs/DOKPLOY.md)

> 速率限制器是进程内内存实现，单实例可用，多副本扩容前需替换为 Redis 等共享存储。

## 测试

- 框架：Vitest 4 + jsdom + `fake-indexeddb`
- 测试与源代码就近（`__tests__/` 子目录）
- 全局 setup：[`src/__tests__/setup.ts`](./src/__tests__/setup.ts)
- mock 一律用 `vi.fn()`（不是 `jest.fn()`）

```bash
pnpm test:run            # 全量
pnpm test:coverage       # 覆盖率（v8）
```

## SEO

- Next.js Metadata API 集中管理 title / description / OG / Twitter
- `hreflang` 声明 5 种语言（zh-CN / zh-TW / en / ja / ko / x-default）
- 自动生成 1200×630 OG 与 Twitter 卡片图（edge runtime）
- 私有路径（`/player/`、`/settings`、`/account`）声明 `robots: noindex` 并在 `robots.ts` 屏蔽
- `SoftwareApplication` + `WebSite` JSON-LD

## 贡献

1. Fork & 新建分支：`git checkout -b feat/your-feature`
2. 修改后跑通：`pnpm lint && pnpm type-check && pnpm test:run`
3. 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 提交信息
4. 推送并开 PR（参考 [docs/GIT-WORKFLOW.md](./docs/GIT-WORKFLOW.md)）

详细约定见 [CLAUDE.md](./CLAUDE.md)。

## 许可证

[MIT](./LICENSE)

## 致谢

[Next.js](https://nextjs.org/) · [React](https://react.dev/) · [Radix UI](https://www.radix-ui.com/) · [Tailwind CSS](https://tailwindcss.com/) · [Dexie](https://dexie.org/) · [TanStack Query](https://tanstack.com/query) · [Groq](https://groq.com/) · [Vitest](https://vitest.dev/) · [Biome](https://biomejs.dev/)

---

<div align="center">

如果项目对你有帮助，欢迎 Star ⭐

[Issue](https://github.com/youming-ai/shadowing-learning/issues) · [Discussions](https://github.com/youming-ai/shadowing-learning/discussions)

</div>
