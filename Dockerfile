# syntax=docker/dockerfile:1.7-labs
FROM oven/bun:1-alpine AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev
WORKDIR /temp/dev

COPY --parents package.json bun.lock patches */*/package.json /temp/dev/
RUN --mount=type=cache,target=/root/.bun bun install --frozen-lockfile

FROM base AS builder
COPY --from=install /temp/dev/node_modules /usr/src/app/node_modules
COPY . .

WORKDIR /usr/src/app/packages/api
ENV NODE_ENV=production
# Sadly, pulsar doesnt work with bun just yet
# RUN bun ./build/build.ts
RUN bun ./build/build-node.ts

# FROM base AS runner
FROM node:22-alpine AS runner
# Annoying: pulsar client doesn't play well with bundlers
COPY --from=install /temp/dev/node_modules/pulsar-client /usr/src/app/node_modules/pulsar-client

WORKDIR /app
COPY --from=builder /usr/src/app/packages/api/dist/ /app/
COPY --from=builder /usr/src/app/packages/db/drizzle/ /app/drizzle

ENV NODE_ENV=production
ENV PORT=80
ENV API_PORT=80

# ENTRYPOINT ["bun", "run", "server"]
ENTRYPOINT ["node", "node.js"]