import { trpcServer } from "@hono/trpc-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { streamSSE } from "hono/streaming";
import { trimTrailingSlash } from "hono/trailing-slash";
import pino from "pino";
import rabbit from "rabbitmq-stream-js-client";
import superjson from "superjson";

import {
  appRouter,
  createTRPCContext,
  ensureStream,
  getSession,
  ingest,
  rabbitMqClientPromise,
} from "@stu/api";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import { Event } from "@stu/lib";
import { getSessionTokenFromHeaders } from "@stu/lib-server";

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

    const streamName = `events-${session.user.id}`;
    const offset = c.req.query("offset");

    const rabbitMqClient = await rabbitMqClientPromise;
    await ensureStream(rabbitMqClient, streamName);

    return streamSSE(c, async (stream) => {
      const consumer = await rabbitMqClient.declareConsumer(
        {
          stream: streamName,
          offset:
            offset !== undefined
              ? rabbit.Offset.offset(BigInt(offset))
              : rabbit.Offset.first(),
        },
        (message) => {
          console.log(`Received message ${message.content.toString()}`);
          void stream.writeSSE({
            data: message.content.toString(),
          });
        },
      );

      stream.onAbort(async () => {
        await consumer.close(true);
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
    const eventJson = superjson.parse(bodyRaw);
    const event = Event.safeParse(eventJson);

    if (!event.success) {
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

    if (res !== undefined) {
      c.status(400);
      return c.text("Failed to ingest event");
    }

    return c.text("Event ingested");
  });

  return app;
};
