import { createServer, type Server } from "node:http";
import { flushOtlp } from "@stu/observability/server";
import { otlpJsonTestLayer } from "@stu/observability/testing";
import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Metric from "effect/Metric";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { describe, expect, it } from "vite-plus/test";
import { withConsoleRuntime } from "../runtime.ts";
import { runObservabilityCanary } from "./observability.ts";

interface ReceivedRequest {
  readonly path: string;
  readonly body: string;
}

const TcpAddress = Schema.Struct({ port: Schema.Finite });

async function startReceiver() {
  const received: Array<ReceivedRequest> = [];
  const server = createServer((request, response) => {
    request.setEncoding("utf8");
    let body = "";
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      received.push({ path: request.url ?? "", body });
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
  });

  await listen(server);
  const address = server.address();
  if (!Schema.is(TcpAddress)(address)) {
    await close(server);
    throw new Error("Console OTLP test receiver did not expose a TCP address");
  }

  return {
    endpoint: `http://127.0.0.1:${address.port}`,
    received,
    close: () => close(server),
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

describe("console observability", () => {
  it("exports a correlated all-signal canary", async () => {
    const receiver = await startReceiver();
    const runtime = ManagedRuntime.make(
      otlpJsonTestLayer({
        endpoint: receiver.endpoint,
        resource: {
          serviceName: "studienbuch-console",
          serviceVersion: "test-release",
          environment: "test",
        },
      }).pipe(
        Layer.provide(FetchHttpClient.layer),
        Layer.provideMerge(Layer.succeed(Metric.MetricRegistry, new Map())),
      ),
    );

    try {
      const canary = await runtime.runPromise(runObservabilityCanary);
      await runtime.runPromise(flushOtlp);

      const byPath = new Map(receiver.received.map((request) => [request.path, request.body]));
      expect([...byPath.keys()].sort()).toEqual(["/v1/logs", "/v1/metrics", "/v1/traces"]);
      expect(byPath.get("/v1/traces")).toContain("Console.observabilityCanary");
      expect(byPath.get("/v1/traces")).toContain(canary.traceId);
      expect(byPath.get("/v1/logs")).toContain(canary.traceId);
      expect(byPath.get("/v1/logs")).toContain(canary.spanId);
      expect(byPath.get("/v1/metrics")).toContain("studienbuch_observability_canary_total");
    } finally {
      await runtime.dispose();
      await receiver.close();
    }
  });

  it("does not fail the workflow when the exporter is unavailable", async () => {
    const runtime = ManagedRuntime.make(
      otlpJsonTestLayer({
        endpoint: "http://127.0.0.1:1",
        resource: {
          serviceName: "studienbuch-console",
          serviceVersion: "test-release",
          environment: "test",
        },
        shutdownTimeout: "100 millis",
      }).pipe(
        Layer.provide(FetchHttpClient.layer),
        Layer.provideMerge(Layer.succeed(Metric.MetricRegistry, new Map())),
      ),
    );

    try {
      const result = await runtime.runPromise(runObservabilityCanary);
      await runtime.runPromise(flushOtlp.pipe(Effect.timeoutOption("500 millis")));
      expect(result.traceId).toMatch(/^[0-9a-f]{32}$/);
    } finally {
      await runtime.dispose();
    }
  });

  it("preserves command failures while the disabled runtime flushes and disposes", async () => {
    const exit = await Effect.fail("expected").pipe(withConsoleRuntime, Effect.runPromiseExit);
    expect(exit).toEqual(Exit.fail("expected"));
  });

  it("preserves interruption while the disabled runtime flushes and disposes", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const fiber = yield* withConsoleRuntime(
          Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)),
        ).pipe(Effect.forkChild);

        yield* Deferred.await(started);
        yield* Fiber.interrupt(fiber);
        const exit = yield* Fiber.await(fiber);

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
        }
      }),
    );
  });
});
