import { trpcServer } from "@hono/trpc-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { trimTrailingSlash } from "hono/trailing-slash";
import pino from "pino";

import { appRouter, createTRPCContext } from "@stu/api";
import { getSessionFromHeaders } from "@stu/lib-server";

import { env } from "./env";

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

export const createBase = (basePath: string) => {
  const app = new OpenAPIHono().basePath(basePath);

  app.use(trimTrailingSlash());
  app.use(prettyJSON());
  app.use(logger((str, ...rest) => appLogger.info(str, ...rest)));

  app.doc("/openapi", {
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "My API",
    },
    servers: [
      {
        description: "Production server",
        url: "https://api.studienbuch.app",
      },
      {
        description: "Development server",
        url: "http://localhost:3000",
      },
    ],
  });

  app.get(
    "/reference",
    apiReference({
      theme: "purple",
      spec: {
        url: "/openapi",
      },
    }),
  );

  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: async ({ req }) =>
        createTRPCContext({
          source: req.headers.get("x-trpc-source") ?? "unknown",
          session: await getSessionFromHeaders(req.headers),
          log: appLogger,
        }),
    }),
  );

  return app;
};
