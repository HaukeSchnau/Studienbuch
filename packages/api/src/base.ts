import net from "node:net";
import { attachSyncServer } from "@groundswell/adapter-hono-server";
import { trpcServer } from "@hono/trpc-server";
import { appRouter, createTRPCContext } from "@stu/api";
import { sql } from "@stu/db";
import { db } from "@stu/db/client";
import { getSessionTokenFromHeaders } from "@stu/lib-server";
import { Effect } from "effect";
import { type Context, Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { trimTrailingSlash } from "hono/trailing-slash";
import pino from "pino";
import type { ZodSchema } from "zod";
import { DomainEvent as DomainEventSchema } from "@stu/lib";
import type { DomainEvent } from "../../db/src/domain-event";
import { env } from "../env";
import { DomainBroadcast, DomainIngestEngine } from "./boilerplate";
import { resolveUserIdFromHeaders } from "./services/session-service";
import { resolveSnapshotRequest } from "./services/snapshot-request-service";

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

const checkDatabaseReadiness = async () => {
  await db.execute(sql`select 1`);
};

const parseEventStreamEndpoint = (url: string) => {
  try {
    const parsed = new URL(url);
    const port = Number(parsed.port);
    if (!parsed.hostname || !Number.isFinite(port) || port <= 0) {
      return null;
    }
    return {
      host: parsed.hostname,
      port,
    };
  } catch {
    return null;
  }
};

const checkEventStreamReadiness = async () => {
  const endpoint = parseEventStreamEndpoint(env.PULSAR_URL);
  if (!endpoint) {
    throw new Error(`Invalid PULSAR_URL: ${env.PULSAR_URL}`);
  }

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection(endpoint);
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      fn();
    };

    socket.setTimeout(1500);
    socket.once("connect", () => {
      settle(() => {
        socket.end();
        resolve();
      });
    });
    socket.once("timeout", () => {
      settle(() => {
        socket.destroy();
        reject(new Error(`Timed out connecting to ${endpoint.host}:${endpoint.port}`));
      });
    });
    socket.once("error", (error) => {
      settle(() => {
        socket.destroy();
        reject(error);
      });
    });
  });
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

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

  const getUserId = async (c: Context) => resolveUserIdFromHeaders(new Headers(c.req.header()));

  app.get("/livez", (c) => c.json({ status: "ok" }, 200));

  app.get("/healthz", async (c) => {
    const checks = {
      database: { ok: true as boolean, error: null as null | string },
      eventStream: { ok: true as boolean, error: null as null | string },
    };

    await checkDatabaseReadiness().catch((error) => {
      checks.database.ok = false;
      checks.database.error = errorMessage(error);
    });
    await checkEventStreamReadiness().catch((error) => {
      checks.eventStream.ok = false;
      checks.eventStream.error = errorMessage(error);
    });

    const healthy = checks.database.ok && checks.eventStream.ok;
    return c.json(
      {
        status: healthy ? "ok" : "degraded",
        checks,
      },
      healthy ? 200 : 503,
    );
  });

  app.post("/api/snapshot", async (c) => {
    const result = await resolveSnapshotRequest({
      headers: new Headers(c.req.header()),
      getBody: () => c.req.json(),
    });

    if (result.status === "unauthorized") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (result.status === "invalid-request") {
      return c.json({ error: "Invalid snapshot request" }, 400);
    }

    return c.json(result.snapshot, 200);
  });

  const syncApi = new Hono();
  // Transitional cast for linked Groundswell package instance mismatch.
  attachSyncServer(syncApi as never, {
    ingestEngine: ingestEngine as never,
    broadcast: broadcast as never,
    getUserId: getUserId as never,
    eventSchema: DomainEventSchema as unknown as ZodSchema<DomainEvent>,
  });
  app.route("/api", syncApi);

  app.onError((err, c) => {
    appLogger.error(
      // oxlint-disable-next-line @typescripttypescript/restrict-template-expressions -- TODO
      `Error while handling request: ${c.req.method} ${c.req.path}: ${err.message}\n${err.stack}\n${err.cause}\n${err.name}`,
    );

    c.status(500);
    return c.text("Internal server error");
  });

  return app;
});
