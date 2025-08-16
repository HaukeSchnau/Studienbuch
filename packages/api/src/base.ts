import { attachSyncServer } from "@groundswell/adapter-hono-server";
import { trpcServer } from "@hono/trpc-server";
import { appRouter, createTRPCContext, getSession } from "@stu/api";
import { DomainEvent } from "@stu/lib";
import { getSessionTokenFromHeaders } from "@stu/lib-server";
import { Effect } from "effect";
import { type Context, Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { trimTrailingSlash } from "hono/trailing-slash";
import pino from "pino";
import { env } from "../env";
import { DomainBroadcast, DomainIngestEngine } from "./boilerplate";

const appLogger = pino({
  transport: {
    targets: [
      {
        target: "pino-pretty",
        options: {
          colorize: true,
        },
      },
      {
        target: "@axiomhq/pino",
        options: {
          dataset: env.AXIOM_DATASET,
          token: env.AXIOM_TOKEN,
        },
      },
    ],
  },
});

export const createBase = Effect.fn(function* (basePath: string) {
  const ingestEngine = yield* DomainIngestEngine;
  const broadcast = yield* DomainBroadcast;

  const app = new Hono().basePath(basePath);

  app.use(trimTrailingSlash());
  app.use(prettyJSON());
  app.use(logger((str, ...rest) => appLogger.info([str, ...rest].join(" "))));

  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: async ({ req }) =>
        createTRPCContext({
          source: req.headers.get("x-trpc-source") ?? "unknown",
          sessionToken: getSessionTokenFromHeaders(req.headers),
          log: appLogger,
        }),
    }),
  );

  const getUserId = async (c: Context) => {
    const sessionToken = getSessionTokenFromHeaders(new Headers(c.req.header()));
    if (!sessionToken) return null;

    const session = await getSession(sessionToken);
    if (!session) return null;

    return session.user.id;
  };

  attachSyncServer(app.basePath("/api"), {
    ingestEngine,
    broadcast,
    getUserId,
    eventSchema: DomainEvent,
  });

  app.onError((err, c) => {
    appLogger.error(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- TODO
      `Error while handling request: ${c.req.method} ${c.req.path}: ${err.message}\n${err.stack}\n${err.cause}\n${err.name}`,
    );

    c.status(500);
    return c.text("Internal server error");
  });

  return app;
});
