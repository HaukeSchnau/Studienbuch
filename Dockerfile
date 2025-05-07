# syntax=docker/dockerfile:1.7-labs
FROM oven/bun:1-alpine AS base
WORKDIR /app
RUN --mount=type=cache,target=/root/.bun/install/cache bun install -g turbo@2

FROM base AS install
COPY --parents package.json bun.lock patches */*/package.json /app/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

FROM base AS builder
COPY --from=install /app/node_modules /app/node_modules

FROM base AS prune
COPY . .

# BEGIN: API
FROM prune AS api-prune
RUN turbo prune @stu/api

FROM builder AS api-builder
COPY --from=api-prune /app/out/ .
WORKDIR /app/packages/api
ENV NODE_ENV=production
RUN bun ./build/build-node.ts

FROM node:22-alpine AS api
WORKDIR /app
# Annoying: pulsar client doesn't play well with bundlers and expects to be installed in node_modules
COPY --from=install /app/node_modules/pulsar-client /app/node_modules/pulsar-client
COPY --from=api-builder /app/packages/api/dist/ /app/

ENV NODE_ENV=production
ENV PORT=80
ENV API_PORT=80
ENTRYPOINT ["node", "node.js"]  
# END: API

# BEGIN: CONSOLE
FROM prune AS console-prune
RUN turbo prune @stu/console

FROM builder AS console-builder
COPY --from=console-prune /app/out/ .
WORKDIR /app/packages/console
ENV NODE_ENV=production
RUN bun ./build/build-node.ts

FROM node:22-alpine AS console
WORKDIR /app
# Annoying: pulsar client doesn't play well with bundlers and expects to be installed in node_modules
COPY --from=install /app/node_modules/pulsar-client /app/node_modules/pulsar-client
COPY --from=console-builder /app/packages/console/dist/ /app/

ENV NODE_ENV=production
ENTRYPOINT ["node", "console.js"]

FROM console AS console-cron
RUN echo "cd /app && node console.js \$@" > /bin/console
RUN chmod +x /bin/console
ENTRYPOINT ["crond", "-f", "-l", "0"]
# END: CONSOLE

# BEGIN: MIGRATIONS
FROM prune AS migrations-prune
RUN turbo prune @stu/db

FROM builder AS migrations
COPY --from=migrations-prune /app/out/ .
WORKDIR /app/packages/db

ENV NODE_ENV=production

ENTRYPOINT [ "bun", "drizzle-kit", "migrate" ]
# END: MIGRATIONS
