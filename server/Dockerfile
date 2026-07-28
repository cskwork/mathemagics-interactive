# syntax=docker/dockerfile:1
# 셀프호스트 서버(Bun + Hono + bun:sqlite) 단일 이미지.
# 정적 빌드(dist/) 를 이미지 안에 구워 넣고, API 와 함께 서빙한다.
# 근거: docs/self-host.md · docs/research/architecture-hosting.md §2b.

# 1) 빌드 단계 — Node 로 클라이언트 정적 자산을 만든다.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) 런타임 — Bun 으로 서버 실행.
FROM oven/bun:1.3 AS runtime
WORKDIR /app
COPY package*.json ./
RUN bun install --production
COPY server/ ./server/
COPY src/lib/storage/types.ts ./src/lib/storage/types.ts
COPY --from=build /app/dist ./dist

ENV PORT=3000
ENV DB_PATH=/data/data.sqlite
ENV STATIC_DIR=/app/dist
ENV BASE_PATH=/mathemagics-interactive/
EXPOSE 3000
# data.sqlite 을 볼륨에 두면 백업·이식이 쉽다(NAS 사용자에게 익숙한 경로).
VOLUME ["/data"]

CMD ["bun", "run", "server/index.ts"]
