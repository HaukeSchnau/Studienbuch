import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { streamSSE } from "hono/streaming";
import { trimTrailingSlash } from "hono/trailing-slash";
import pino from "pino";

import {
  appRouter,
  createTRPCContext,
  getSession,
  ingest,
  subscribe,
} from "@stu/api";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import { Result, deserializeEvent, serializeEvent } from "@stu/lib";
import { getSessionTokenFromHeaders } from "@stu/lib-server";

import { env } from "../env";

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
  const app = new Hono().basePath(basePath);

  app.use(trimTrailingSlash());
  app.use(prettyJSON());
  app.use(logger((str, ...rest) => appLogger.info(str, ...rest)));

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

  app.get("/events", async (c) => {
    const sessionToken = getSessionTokenFromHeaders(
      new Headers(c.req.header()),
    );
    if (!sessionToken) {
      c.status(401);
      return c.text("Unauthorized");
    }

    const session = await getSession(sessionToken);
    if (!session) {
      c.status(401);
      return c.text("Unauthorized");
    }

    const offset = c.req.query("offset");

    return streamSSE(c, async (stream) => {
      const consumer = await subscribe(session.user.id, offset, (event) => {
        void stream.writeSSE({
          data: serializeEvent(event),
        });
      });

      stream.onAbort(async () => {
        await consumer.close();
      });

      await new Promise(() => {
        // Keep the stream open indefinitely
      });
    });
  });

  app.post("/events", async (c) => {
    const sessionToken = getSessionTokenFromHeaders(
      new Headers(c.req.header()),
    );
    if (!sessionToken) {
      c.status(401);
      return c.text("Unauthorized");
    }

    const session = await getSession(sessionToken);
    if (!session) {
      c.status(401);
      return c.text("Unauthorized");
    }

    const bodyRaw = await c.req.text();
    const event = deserializeEvent(bodyRaw);

    if (!event.success) {
      console.log(
        "INVALID EVENT",
        event.error,
        bodyRaw,
        event.error.format(),
        bodyRaw,
      );
      c.status(400);
      return c.text("Invalid event");
    }

    const existingEvent = await db
      .select()
      .from(tables.events)
      .where(eq(tables.events.id, event.data.id));

    if (existingEvent.length > 0) {
      c.status(409);
      return c.text("Event already exists");
    }

    const res = await ingest(event.data.type, event.data, session.user.id);

    if (Result.isErr(res)) {
      console.log("FAILED TO INGEST EVENT", event.data, res);
      c.status(400);
      return c.text("Failed to ingest event");
    }

    return c.status(200);
  });

  return app;
};
