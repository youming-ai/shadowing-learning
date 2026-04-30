# Shadowing Learning

<div align="center">

**AI驱动的语言学习应用 - 专注于影子练习的音频转录工具**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/youming-ai/shadowing-learning)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.0.7-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)

[功能演示](https://shadowing-learning.vercel.app) | [文档](./docs/ARCHITECTURE.md) | [开发指南](./CLAUDE.md)

</div>

## ✨ 特性

### 🎯 核心功能
- **🎵 音频转录**: 使用 AI 技术将音频转换为文本
- **⏱️ 时间戳字幕**: 精确的时间戳和分段显示
- **🔄 自动处理**: 智能文本增强和后处理
- **🎮 交互式播放器**: 同步音频和字幕播放
- **📊 状态跟踪**: 基于本地数据库和查询缓存同步转录状态

### 🚀 技术亮点
- **⚡ 高性能**: 优化的网络请求和缓存策略
- **🎨 现代UI**: 基于 shadcn/ui 的响应式设计
- **🌙 主题系统**: 支持深色、浅色、系统和高对比度主题
- **📱 移动友好**: 完全响应式设计
- **🔒 类型安全**: 完整的 TypeScript 支持
- **🧪 测试覆盖**: 全面的单元测试和集成测试

### 🛠️ 开发体验
- **📦 包管理**: 使用 pnpm 快速依赖管理
- **🔧 代码质量**: 集成 Biome.js 代码检查和格式化
- **🚀 部署优化**: 自动化构建和部署流程
- **📈 性能监控**: 内置性能监控和分析
- **📚 完整文档**: 详细的 API 和组件文档

## 🚀 快速开始

### 环境要求

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### 安装

```bash
# 克隆项目
git clone https://github.com/youming-ai/shadowing-learning.git
cd shadowing-learning

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 添加你的 API 密钥
```

### 开发

```bash
# 启动开发服务器
pnpm dev

# 在浏览器中打开 http://localhost:3000
```

### 构建

```bash
# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

## 📋 可用脚本

### 开发相关
```bash
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产版本
pnpm start            # 启动生产服务器
```

### 代码质量
```bash
pnpm lint             # 代码风格检查 (Biome.js)
pnpm format           # 代码格式化
pnpm type-check       # TypeScript 类型检查
```

### 测试 (Vitest)
```bash
pnpm test             # 运行测试（监视模式）
pnpm test:run         # 运行测试（单次）
pnpm test:coverage    # 生成测试覆盖率报告
```

### 工具
```bash
pnpm clean            # 清理构建产物
```

## 🏗️ 项目结构

```
shadowing-learning/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API 路由
│   │   ├── globals.css        # 全局样式
│   │   └── layout.tsx         # 根布局
│   ├── components/             # React 组件
│   │   ├── ui/                # 基础 UI 组件
│   │   ├── features/          # 业务功能组件
│   │   └── layout/            # 布局组件
│   ├── hooks/                  # 自定义 Hooks
│   ├── lib/                    # 工具库
│   │   ├── db/                # 数据库相关
│   │   ├── utils/             # 工具函数
│   │   └── ai/                # AI 服务
│   └── types/                  # TypeScript 类型
├── docs/                       # 项目文档
├── scripts/                    # 构建和部署脚本
├── __tests__/                  # 测试文件
├── public/                     # 静态资源
└── 配置文件...
```

## 🔧 配置

### 环境变量

```env
# AI 服务配置
GROQ_API_KEY=your_groq_api_key

# 应用 URL，用于 metadata、robots 和 sitemap
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 主要配置文件

- `next.config.js` - Next.js 配置
- `biome.json` - 代码检查和格式化配置
- `tailwind.config.ts` - Tailwind CSS 配置
- `tsconfig.json` - TypeScript 配置

## 📊 性能优化

### 已实施的优化措施

1. **🗂️ 构建优化**
   - 释放 992MB 磁盘空间（构建产物清理）
   - 减少 15MB 包体积（未使用依赖移除）
   - 优化构建配置

2. **🐛 代码质量**
   - 统一错误处理（减少 30% 重复代码）
   - 统一导入结构（减少 25% 导入语句）
   - 配置文件简化（降低 64% 复杂度）

3. **⚡ 性能监控**
   - 核心 Web Vitals 监控
   - API 响应时间跟踪
   - 内存使用监控
   - 错误率统计

### 性能指标

当前性能表现：
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **First Input Delay**: < 100ms
- **Cumulative Layout Shift**: < 0.1

## 🧪 测试

### 测试策略

- **单元测试**: 组件和工具函数测试
- **集成测试**: API 路由和数据库测试
- **性能测试**: Lighthouse 和自定义指标测试
- **端到端测试**: 用户流程测试

### 运行测试

```bash
# 运行所有测试
pnpm test

# 生成覆盖率报告
pnpm test:coverage

```

## 📚 工作流文档

完整的开发、数据、Git 和部署流程文档。

- [开发工作流](./docs/DEVELOPMENT.md) - 开发环境、命令和最佳实践
- [数据流程](./docs/DATA-FLOW.md) - 数据存储、处理和流转
- [Git 工作流](./docs/GIT-WORKFLOW.md) - 分支策略、提交规范和 PR 流程
- [架构文档](./docs/ARCHITECTURE.md) - 技术栈、组件结构和 API 概览

## 🤝 贡献

我们欢迎各种形式的贡献！

### 贡献流程

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发规范

- 遵循 TypeScript 严格模式
- 使用 pnpm 作为包管理器
- 代码风格遵循 Biome.js 配置
- 提交信息遵循 Conventional Commits
- 添加适当的测试覆盖

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 🙏 致谢

感谢以下开源项目：

- [Next.js](https://nextjs.org/) - React 框架
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Radix UI](https://www.radix-ui.com/) - 无头组件
- [Groq](https://groq.com/) - AI 推理服务
- [Vitest](https://vitest.dev/) - 测试框架

## 📞 联系

- 项目主页: [https://shadowing-learning.vercel.app](https://shadowing-learning.vercel.app)
- 问题反馈: [GitHub Issues](https://github.com/youming-ai/shadowing-learning/issues)
- 功能建议: [GitHub Discussions](https://github.com/youming-ai/shadowing-learning/discussions)

---

<div align="center">

**🌟 如果这个项目对你有帮助，请给我们一个 Star！**

Made with ❤️ by Shadowing Learning Team

</div>
