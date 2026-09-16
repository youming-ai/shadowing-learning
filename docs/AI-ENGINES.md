# AI 引擎：默认额度 与 BYOK

> 翻译/标注是产品里唯一的 AI 调用。它有**两条互斥的链路**，用户二选一。

## 为什么要两条

| | 默认（服务器额度） | BYOK（自带 key） |
|---|---|---|
| 用户要做什么 | 什么都不用做 | 自己去申请一个 API key 填进来 |
| key 在哪 | Cloudflare Worker secret | 用户自己浏览器的 `localStorage` |
| 请求路径 | 浏览器 → 我们的 Worker → 供应商 | 浏览器 → 供应商（我们不经手） |
| 谁付 token 钱 | 我们（受 `RATE_LIMIT_KV` 限流护栏约束） | 用户自己的额度 |
| 适用人群 | 绝大多数人 | 重度用户 / 在意密钥不经过第三方的用户 |

竞品调研（`docs/research/trancy-extension-analysis.md`）显示 Trancy 也提供 BYOK，
但它的**引擎列表连同 key 是从自己服务器拉的**（`GET /2/translator/engines`），
所以"Trancy 看不到你的 key"并不成立——它只做到"不代理 BYOK 的推理请求"。
**我们两条都做到了**：目录是静态数据、key 只存本机、直连请求不经过我们。
这是可以明确写在对比表里的差异。

## 安全模型（必须如实说明，不要含糊）

BYOK 的 key：

- 只落在**本机 `localStorage`**，命名空间 `shadowing.ai.*`；
- **只**发往用户所选供应商的域名（`src/lib/ai/transports.ts` 保证，有测试守着
  "服务器请求体里绝不含 key"这条不变量）；
- 不进 IndexedDB、不进查询缓存、不写日志。

**但是**：`localStorage` 与我们的页面同源，因此任何能在本站执行的脚本
（XSS、被投毒的依赖）都能读走 key。这是 BYOK 的固有代价，不是本实现的疏漏。
所以：

1. 设置页必须写明这一点（见 `settings.ai.privacy`，4 个语种都有）；
2. 默认路径不需要用户交出任何密钥——**不填 key 是安全的默认状态**。

## 代码结构

```
shared/ai/postprocess-core.ts     ← prompt、分流、解析、降级的唯一实现（纯函数）
  ↑ 相对导入                          ↑ 相对导入
worker/routes/postprocess.ts       src/lib/ai/transports.ts
（服务器额度）                       （BYOK 直连）
```

分层理由：

| 层 | 位置 | 职责 |
|---|---|---|
| 内核 | `shared/ai/postprocess-core.ts` | prompt 构造、短文本合批 / 长文本逐条的分流、JSON 解析、失败降级。接收注入的 `ChatFn`，不碰网络 |
| 协议 | `src/lib/ai/protocol.ts` | 把中立的 `ChatRequest` 映射成各家线上格式并解析响应（`openai` / `anthropic` 两个协议） |
| 目录 | `src/lib/ai/catalog.ts` | **声明式数据**：供应商、端点、协议、默认模型 |
| 密钥 | `src/lib/ai/keys.ts` | 本机存储、掩码、清理 |
| 传输 | `src/lib/ai/transports.ts` | 两条链路的实现 + 引擎解析与回退 |
| 编排 | `src/lib/subtitles/chunk-postprocess.ts` | 分片与逐片回写（不关心谁来翻译） |

**为什么 prompt 必须只有一份**：它以前只存在于 Worker 里。BYOK 需要客户端也能构造
同一套 prompt，而两份拷贝必然漂移——输出的翻译质量会悄悄分叉且无人察觉。
所以提到运行时中立的 `shared/`，两边相对导入（Worker 侧不能走 `~` 别名，
wrangler 不认识别名，这点在 `shared/ai/postprocess-core.ts` 的注释里也写了）。

## 支持的供应商

目录里的每一条都**实测过 CORS**：预检返回 `access-control-allow-origin` 且允许
`authorization` 头，浏览器才能直连。加新供应商前请做同样的预检，否则会做出一个
"看起来能用、一按就失败"的选项。

| 供应商 | 协议 | 备注 |
|---|---|---|
| Groq | openai | 与我们服务器路径同一个模型，两条链路输出风格一致 |
| OpenAI | openai | |
| Anthropic | anthropic | `system` 是顶层参数、`max_tokens` 必填、无 `response_format`；需要官方浏览器直连头 |
| DeepSeek | openai | 预检回显 origin 并 `allow-credentials: true` |

**模型 ID 会过期**：我们不像 Trancy 那样有服务端目录可拉，目录是静态的。
因此 UI 里模型字段**可自由编辑**，`suggestedModels` 只是预填建议而非白名单——
即使某个 ID 下架，用户也不会被卡住。

## 引擎解析与回退

`resolveEngine()` 是唯一入口：

- 默认 → 服务器额度；
- 选了某供应商且**有 key** → 直连；
- 选了供应商但**没 key**（或 id 未知）→ 回退服务器额度，并返回
  `fellBackToServer: true`，让调用方能说明"你选了 BYOK 但还没填 key，当前走免费额度"，
  而不是让用户对着一个必然失败的选项发呆。

## 测试

| 文件 | 覆盖 |
|---|---|
| `shared/ai/__tests__/postprocess-core.test.ts` | 分流边界（阈值 50）、批处理位置映射、批量失败整批降级 / 单条失败只降级单条、非法 JSON、乱序归位 |
| `src/lib/ai/__tests__/ai-transport.test.ts` | 目录数据完整性、两种协议的请求构造（含 key 只进请求头）、响应解析、错误分类、密钥存取与掩码、**服务器请求体不含 key**、引擎回退 |

## 后续可做

- 供应商侧还有一类可选能力：OpenAI 兼容端点普遍提供 `GET /v1/models`，可以在填好 key 后
  拉取真实模型列表，替换静态建议。
- BYOK 的 key 目前无"测一下是否有效"的按钮；填错 key 会在第一次翻译时才暴露
  （错误信息已经能区分 `INVALID_KEY` 与 `RATE_LIMITED`，UI 可用它给出不同指引）。
