import { createServer, type Server } from "node:http";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Metric from "effect/Metric";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { describe, expect, it } from "vite-plus/test";
import { runCanary } from "./index.ts";
import { flushOtlp, otlpProtobufLayer } from "./server.ts";
import { otlpJsonTestLayer } from "./testing.ts";

interface ReceivedRequest {
  readonly path: string;
  readonly contentType: string | undefined;
  readonly body: string;
}

interface Receiver {
  readonly endpoint: string;
  readonly received: Array<ReceivedRequest>;
  readonly close: () => Promise<void>;
}

const TcpAddress = Schema.Struct({ port: Schema.Finite });

async function startReceiver(): Promise<Receiver | undefined> {
  const received: Array<ReceivedRequest> = [];
  const server = createServer((request, response) => {
    request.setEncoding("utf8");
    let body = "";
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      received.push({
        path: request.url ?? "",
        contentType: request.headers["content-type"],
        body,
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
  });

  await listen(server);
  const address = server.address();
  if (!Schema.is(TcpAddress)(address)) {
    await close(server);
    return undefined;
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

const resource = {
  serviceName: "studienbuch-server",
  serviceVersion: "test-release",
  environment: "test",
} as const;

describe("Effect OTLP integration", () => {
  it("explicitly flushes correlated traces, logs, and metrics", async () => {
    const receiver = await startReceiver();
    expect(receiver).toBeDefined();
    if (receiver === undefined) return;
    const runtime = ManagedRuntime.make(
      otlpJsonTestLayer({ endpoint: receiver.endpoint, resource }).pipe(
        Layer.provide(FetchHttpClient.layer),
        Layer.provideMerge(Layer.succeed(Metric.MetricRegistry, new Map())),
      ),
    );

    try {
      const canary = await runtime.runPromise(runCanary());
      await runtime.runPromise(flushOtlp);

      const byPath = new Map(receiver.received.map((request) => [request.path, request]));
      expect([...byPath.keys()].sort()).toEqual(["/v1/logs", "/v1/metrics", "/v1/traces"]);
      expect(byPath.get("/v1/traces")?.body).toContain(canary.traceId);
      expect(byPath.get("/v1/logs")?.body).toContain(canary.traceId);
      expect(byPath.get("/v1/logs")?.body).toContain(canary.spanId);
      expect(byPath.get("/v1/metrics")?.body).toContain("studienbuch_observability_canary_total");
    } finally {
      await runtime.dispose();
      await receiver.close();
    }
  }, 15_000);

  it("uses protobuf for every production signal endpoint", async () => {
    const receiver = await startReceiver();
    expect(receiver).toBeDefined();
    if (receiver === undefined) return;
    const runtime = ManagedRuntime.make(
      otlpProtobufLayer({
        endpoint: receiver.endpoint,
        resource,
        exportInterval: "1 hour",
        shutdownTimeout: "1 second",
      }).pipe(
        Layer.provide(FetchHttpClient.layer),
        Layer.provideMerge(Layer.succeed(Metric.MetricRegistry, new Map())),
      ),
    );

    try {
      await runtime.runPromise(runCanary());
      await runtime.runPromise(flushOtlp);

      expect(receiver.received.map((request) => request.path).sort()).toEqual([
        "/v1/logs",
        "/v1/metrics",
        "/v1/traces",
      ]);
      for (const request of receiver.received) {
        expect(request.contentType).toBe("application/x-protobuf");
        expect(request.body.length).toBeGreaterThan(0);
      }
    } finally {
      await runtime.dispose();
      await receiver.close();
    }
  });
});
