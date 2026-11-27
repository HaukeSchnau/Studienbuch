import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { describe, expect, it, layer } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { Deployment } from "../config/Deployment.ts";
import { Telemetry } from "./Telemetry.ts";

/** A failure whose message quotes a value, as a library's can. */
class QueryFailed extends Schema.TaggedError<QueryFailed, { readonly brand: unique symbol }>()(
  "Test.QueryFailed",
  {
    address: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message() {
    // A second line that looks like a stack frame, as a quoted body can hold.
    return `Query failed for ${this.address}\n    at ${this.address} (body.json:1:1)`;
  }
}

const address = "quendolin.amselreuter@example.test";

// Postgres's error for a unique key names the row's value in its detail.
const postgres = Object.assign(
  new Error('duplicate key value violates unique constraint "auth_user_email_key"'),
  { code: "23505", constraint: "auth_user_email_key", detail: `Key (email)=(${address})` },
);

describe("Telemetry.withoutText", () => {
  it("keeps a failure's tag, code, constraint and frames, and drops its messages and fields", () => {
    const shown = Cause.pretty(
      Telemetry.withoutText(Cause.fail(new QueryFailed({ address, cause: postgres }))),
    );

    expect({
      head: shown.split("\n")[0],
      cause: shown.includes("[cause]: Error: 23505 auth_user_email_key"),
      frames: shown.includes("Telemetry.test.ts"),
      address: shown.includes(address),
      message: shown.includes("duplicate key"),
    }).toEqual({
      head: "Test.QueryFailed: ",
      cause: true,
      frames: true,
      address: false,
      message: false,
    });
  });
});

/** Every OTLP request the collector received, as its path and its body's bytes as text. */
class Received extends Context.Service<
  Received,
  Array<{ readonly path: string; readonly body: string }>
>()("TelemetryTest.Received") {}

const collector = HttpRouter.serve(
  HttpRouter.add("POST", "/v1/*", (request) =>
    Effect.gen(function* () {
      const received = yield* Received;
      const body = yield* request.arrayBuffer;

      received.push({ path: request.url, body: new TextDecoder("latin1").decode(body) });

      return HttpServerResponse.empty({ status: 200 });
    }).pipe(Effect.orDie),
  ),
  { disableLogger: true, disableListenLog: true },
).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest),
  Layer.provideMerge(Layer.sync(Received)(() => [])),
);

/** `Telemetry.layer` as `serve` builds it, exporting to the collector. */
const exporting = Layer.unwrap(
  HttpServer.addressFormattedWith((origin) =>
    Effect.succeed(
      Telemetry.layer.pipe(
        Layer.provide(Deployment.layer),
        Layer.provide(
          ConfigProvider.layer(
            ConfigProvider.fromEnv({
              env: { STUDIENBUCH_ENVIRONMENT: "development", OTEL_EXPORTER_OTLP_ENDPOINT: origin },
            }),
          ),
        ),
      ),
    ),
  ),
);

layer(collector, { excludeTestServices: true })("Telemetry.layer", (it) => {
  it.effect("exports logs and spans over OTLP, a failure only as its tags and codes", () =>
    Effect.gen(function* () {
      const failure = new QueryFailed({ address, cause: postgres });

      yield* Effect.logError("A query failed", Cause.fail(failure)).pipe(
        Effect.andThen(Effect.exit(Effect.withSpan(Effect.fail(failure), "Telemetry.test"))),
        Effect.provide(exporting),
      );

      const received = yield* Received;
      const bodies = received.map(({ body }) => body).join("\n");

      expect({
        logs: received.some(({ path }) => path === "/v1/logs"),
        traces: received.some(({ path }) => path === "/v1/traces"),
        tagged: bodies.includes("Test.QueryFailed") && bodies.includes("23505"),
        address: bodies.includes(address),
        message: bodies.includes("Query failed") || bodies.includes("duplicate key"),
      }).toEqual({
        logs: true,
        traces: true,
        tagged: true,
        address: false,
        message: false,
      });
    }),
  );
});
