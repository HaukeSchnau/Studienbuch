# syntax=docker/dockerfile:1.7-labs
FROM oven/bun:1-alpine AS base
WORKDIR /app
RUN --mount=type=cache,target=/root/.bun/install/cache bun install -g turbo@2

FROM base AS install
COPY --parents package.json bun.lock patches */*/package.json /app/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

FROM base AS builder
COPY --from=install /app/node_modules /app/node_modules

FROM base AS api-prune
COPY . .
RUN turbo prune @stu/api

FROM builder AS api-builder
COPY --from=api-prune /app/out/ .
WORKDIR /app/packages/api
ENV NODE_ENV=production
RUN bun ./build/build-node.ts

FROM node:22-alpine AS api
WORKDIR /app
# Annoying: pulsar client doesn't play well with bundlers
COPY --from=install /app/node_modules/pulsar-client /app/node_modules/pulsar-client
COPY --from=api-builder /app/packages/api/dist/ /app/
COPY --from=api-builder /app/packages/db/drizzle/ /app/drizzle

ENV NODE_ENV=production
ENV PORT=80
ENV API_PORT=80
ENTRYPOINT ["node", "node.js"]
