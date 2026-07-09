FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS runtime
ENV NODE_ENV=production

# yt-dlp：官方 release zipapp（pinned）。zipapp 需要 python3；
# 2025.11+ 的 EJS 挑战需要外部 JS runtime（nodejs）。
# 升级方式：改 YTDLP_VERSION 重建镜像（提取器类依赖必须跟随上游滚动，
# 发布前请核对 https://github.com/yt-dlp/yt-dlp/releases 的最新版）。
ARG YTDLP_VERSION=2026.07.04
RUN apk add --no-cache python3 nodejs \
  && wget -O /usr/local/bin/yt-dlp \
     "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp" \
  && chmod +x /usr/local/bin/yt-dlp \
  && yt-dlp --version

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["bun", "run", "dist/server/server.js"]
