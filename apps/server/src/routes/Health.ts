import { System } from "@stu/api/System";
import * as Effect from "effect/Effect";
import * as HttpMiddleware from "effect/http/HttpMiddleware";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { Deployment } from "../infra/config/Deployment.ts";
import { Migrations } from "../infra/database/Migrations.ts";
import { Jobs } from "../infra/jobs/Jobs.ts";

/**
 * What a host gates traffic on. Only `ready` answers 200: the database responds and has every
 * migration of this release. A database ahead of the release is ready, so a rollback keeps working.
 */
export class Readiness extends Schema.Class<Readiness>("Health.Readiness")({
  status: Schema.Literals(["ready", "schema-behind", "database-unavailable"]),
  revision: Schema.String,
  environment: System.Environment,
  schema: Schema.NullOr(
    Schema.Struct({ head: Schema.NullOr(Schema.String), missing: Schema.Array(Schema.String) }),
  ),
  jobs: Schema.Array(
    Schema.Struct({
      name: Jobs.Name,
      enabled: Schema.Boolean,
      lastRun: Schema.NullOr(Schema.DateTimeUtc),
    }),
  ),
}) {}

/** Readiness against the migrations this release ships. `console status` prints the same. */
export const readiness = Effect.gen(function* () {
  const { revision, environment } = yield* Deployment.Current;
  const enabled = yield* Jobs.enabled;
  const jobs = (lastRuns: ReadonlyMap<string, Readiness["jobs"][number]["lastRun"]>) =>
    Jobs.Name.literals.map((name) => ({
      name,
      enabled: enabled.includes(name),
      lastRun: lastRuns.get(name) ?? null,
    }));
  return yield* Effect.gen(function* () {
    const schema = yield* Migrations.status(yield* Migrations.Release);
    // `job_run` may not exist yet while the schema is behind.
    if (schema.missing.length > 0) {
      return new Readiness({
        status: "schema-behind",
        revision,
        environment,
        schema,
        jobs: jobs(new Map()),
      });
    }
    return new Readiness({
      status: "ready",
      revision,
      environment,
      schema,
      jobs: jobs(yield* Jobs.lastRuns),
    });
  }).pipe(
    Effect.catch((cause) =>
      Effect.as(
        Effect.logWarning("Readiness cannot reach the database", cause),
        new Readiness({
          status: "database-unavailable",
          revision,
          environment,
          schema: null,
          jobs: jobs(new Map()),
        }),
      ),
    ),
  );
});

// Hosts poll both routes every few seconds, so they stay out of the request log.
export const layer = Layer.mergeAll(
  // Answers while the event loop runs, and never checks a dependency.
  HttpRouter.add(
    "GET",
    "/api/health/live",
    HttpMiddleware.withLoggerDisabled(Effect.succeed(HttpServerResponse.text("live"))),
  ),
  HttpRouter.add(
    "GET",
    "/api/health/ready",
    HttpMiddleware.withLoggerDisabled(
      Effect.flatMap(readiness, (report) =>
        HttpServerResponse.schemaJson(Readiness)(report, {
          status: report.status === "ready" ? 200 : 503,
        }),
      ),
    ),
  ),
);

export * as Health from "./Health.ts";
