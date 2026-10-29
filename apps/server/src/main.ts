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
import * as Option from "effect/Option";
import * as Runtime from "effect/Runtime";
import * as Schema from "effect/Schema";
// NodeHttpServer.layer takes Node's own server factory; Effect has no counterpart to it.
// oxlint-disable-next-line effecttsgo/node-builtin-import -- see above
import * as NodeHttp from "node:http";
import * as NodeURL from "node:url";
import { SyncEpoch, Tables as SyncTables } from "@stu/sync/server";
import packageJson from "../package.json" with { type: "json" };
import { Auth } from "./auth/Auth.ts";
import { Deployment } from "./infra/config/Deployment.ts";
import { SecretFiles } from "./infra/config/SecretFiles.ts";
import { Database } from "./infra/database/Database.ts";
import { Migrations } from "./infra/database/Migrations.ts";
import { Jobs } from "./infra/jobs/Jobs.ts";
import { Mail } from "./infra/mail/Mail.ts";
import { Telemetry } from "./infra/telemetry/Telemetry.ts";
import { Health } from "./routes/Health.ts";
import { DevServers } from "./routes/DevServers.ts";
import { Rpc } from "./routes/Rpc.ts";
import { WebBuilds } from "./routes/WebBuilds.ts";
import { WellKnown } from "./routes/WellKnown.ts";
import { Notebooks } from "./sync/Notebooks.ts";

// This file runs as `src/main.ts` in the workspace and as `server/main.mjs` in the release bundle,
// which keeps `migrations/`, `web/` and `app/` beside `server/` (hosting.md, section 2).
const besideServer = (name: string) =>
  NodeURL.fileURLToPath(new URL(`../${name}/`, import.meta.url));

const runtime = Layer.mergeAll(
  Database.layer,
  Migrations.layerRelease(besideServer("migrations")),
  Telemetry.layer,
).pipe(Layer.provideMerge(Deployment.layer));

// devenv runs Vite and Metro beside the server and names them, and a release serves their builds.
const webBuilds = Layer.unwrap(
  Effect.map(
    Config.option(
      Config.all({
        web: Config.String("STUDIENBUCH_DEV_WEB_URL"),
        app: Config.String("STUDIENBUCH_DEV_APP_URL"),
      }),
    ),
    Option.match({
      onNone: () => WebBuilds.layer({ web: besideServer("web"), app: besideServer("app") }),
      onSome: DevServers.layer,
    }),
  ),
);

const http = HttpRouter.serve(
  Layer.mergeAll(Health.layer, Rpc.layer, webBuilds, Auth.route, WellKnown.layer),
).pipe(
  Layer.provide(Auth.layer.pipe(Layer.provide(Mail.layer))),
  Layer.provide(
    NodeHttpServer.layerConfig(NodeHttp.createServer, {
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
  yield* SyncEpoch.initialize;
  yield* Effect.logInfo(
    applied.length === 0 ? "The schema is at head" : `Applied ${applied.join(", ")}`,
  );
}).pipe(Effect.provide(runtime));

class InvariantBroken extends Schema.TaggedError<
  InvariantBroken,
  { readonly brand: unique symbol }
>()("Verify.InvariantBroken", {
  invariant: Schema.String,
}) {}

const verify = Effect.gen(function* () {
  yield* Migrations.verify(yield* Migrations.Release);
  const db = yield* Database.Drizzle;

  if ((yield* db.$count(SyncTables.syncEpoch)) !== 1) {
    return yield* new InvariantBroken({ invariant: "sync_epoch holds exactly one row" });
  }

  if ((yield* Notebooks.mismatched).length > 0) {
    return yield* new InvariantBroken({
      invariant: "each notebook's space and row name one school",
    });
  }

  yield* Effect.logInfo("The schema is at head and the invariants hold");
}).pipe(Effect.provide(runtime));

const encodeReadiness = Schema.encodeEffect(
  Schema.fromJsonString(Schema.toCodecJson(Health.Readiness), { space: 2 }),
);

const status = Effect.gen(function* () {
  const report = yield* Health.readiness;
  const json = yield* encodeReadiness(report);

  yield* Console.log(json);
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
