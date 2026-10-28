import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Cause from "effect/Cause";
import * as Command from "effect/cli/Command";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import * as Runtime from "effect/Runtime";
import * as Schema from "effect/Schema";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import packageJson from "../package.json" with { type: "json" };
import { Deployment } from "./infra/config/Deployment.ts";
import { SecretFiles } from "./infra/config/SecretFiles.ts";
import { Database } from "./infra/database/Database.ts";
import { Migrations } from "./infra/database/Migrations.ts";
import { Schema as Tables } from "./infra/database/Schema.ts";
import { Jobs } from "./infra/jobs/Jobs.ts";
import { Telemetry } from "./infra/telemetry/Telemetry.ts";
import { Health } from "./routes/Health.ts";
import { Rpc } from "./routes/Rpc.ts";
import { WebBuilds } from "./routes/WebBuilds.ts";

// This file runs as `src/main.ts` in the workspace and as `server/main.mjs` in the release bundle,
// which keeps `migrations/`, `web/` and `app/` beside `server/` (hosting.md, section 2).
const besideServer = (name: string) => fileURLToPath(new URL(`../${name}/`, import.meta.url));

const runtime = Layer.mergeAll(
  Database.layer,
  Migrations.layerRelease(besideServer("migrations")),
  Telemetry.layer,
).pipe(Layer.provideMerge(Deployment.layer));

const http = HttpRouter.serve(
  Layer.mergeAll(
    Health.layer,
    Rpc.layer,
    WebBuilds.layer({ web: besideServer("web"), app: besideServer("app") }),
  ),
).pipe(
  Layer.provide(
    NodeHttpServer.layerConfig(createServer, {
      host: Config.String("HOST"),
      port: Config.Port("PORT"),
      // On SIGTERM the server stops accepting connections and lets running requests finish.
      gracefulShutdownTimeout: Config.succeed(Duration.seconds(10)),
    }),
  ),
);

const serve = Effect.gen(function* () {
  yield* Migrations.requireHead(yield* Migrations.Release);
  return yield* Layer.launch(Layer.mergeAll(http, Jobs.layer));
}).pipe(Effect.provide(runtime));

const prepare = Effect.gen(function* () {
  const applied = yield* Migrations.apply(yield* Migrations.Release);
  yield* Effect.logInfo(
    applied.length === 0 ? "The schema is at head" : `Applied ${applied.join(", ")}`,
  );
}).pipe(Effect.provide(runtime));

class InvariantBroken extends Schema.TaggedError<InvariantBroken>()("Verify.InvariantBroken", {
  invariant: Schema.String,
}) {}

const verify = Effect.gen(function* () {
  yield* Migrations.verify(yield* Migrations.Release);
  const db = yield* Database.Drizzle;
  if ((yield* db.$count(Tables.syncEpoch)) !== 1) {
    return yield* new InvariantBroken({ invariant: "sync_epoch holds exactly one row" });
  }
  yield* Effect.logInfo("The schema is at head and the invariants hold");
}).pipe(Effect.provide(runtime));

const status = Effect.gen(function* () {
  const report = yield* Health.readiness;
  const json = yield* Schema.encodeEffect(Schema.toCodecJson(Health.Readiness))(report);
  yield* Console.log(JSON.stringify(json, null, 2));
}).pipe(Effect.provide(runtime));

const cli = Command.make("studienbuch-server", {}, () => serve).pipe(
  Command.withDescription("Serves Studienbuch. Without a command, it runs `serve`."),
  Command.withSubcommands([
    Command.make("serve", {}, () => serve).pipe(
      Command.withDescription("HTTP, RPC, the web builds and the jobs role"),
    ),
    Command.make("prepare", {}, () => prepare).pipe(
      Command.withDescription(
        "Applies pending migrations; the host runs it before switching traffic",
      ),
    ),
    Command.make("console").pipe(
      Command.withDescription("Operator commands"),
      Command.withSubcommands([
        Command.make("status", {}, () => status).pipe(
          Command.withDescription("Prints what /api/health/ready reports"),
        ),
      ]),
    ),
    Command.make("verify", {}, () => verify).pipe(
      Command.withDescription("Fails unless the schema is at head and the invariants hold"),
    ),
  ]),
);

// The host stops `serve` with SIGTERM, so an interruption alone is a clean exit.
const teardown: Runtime.Teardown = (exit, onExit) =>
  Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)
    ? onExit(0)
    : Runtime.defaultTeardown(exit, onExit);

Command.run(cli, { version: packageJson.version }).pipe(
  Effect.provide(SecretFiles.layer.pipe(Layer.provideMerge(NodeServices.layer))),
  NodeRuntime.runMain({ teardown }),
);
