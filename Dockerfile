# syntax=docker/dockerfile:1.7-labs
FROM oven/bun:1-alpine AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev
WORKDIR /temp/dev

COPY --parents package.json bun.lock patches */*/package.json packages/expo-native-modules/example/package.json /temp/dev/
RUN --mount=type=cache,target=/root/.bun bun install --frozen-lockfile --ignore-scripts

FROM base AS builder
COPY --from=install /temp/dev/node_modules /usr/src/app/node_modules
COPY . .

WORKDIR /usr/src/app/apps/rest
ENV NODE_ENV=production
RUN bun ./build.ts

FROM base AS runner
WORKDIR /app
COPY --from=builder /usr/src/app/apps/rest/dist/ /app/
COPY --from=builder /usr/src/app/packages/db/drizzle/ /app/drizzle

ENV NODE_ENV=production
ENV PORT=80
ENV API_PORT=80

ENTRYPOINT ["bun", "run", "server"]
