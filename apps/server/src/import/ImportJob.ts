/**
 * The scheduled import (m2-import-path.md, sections 1 and 2): the school's daytime and nightly runs
 * on two `ClusterCron`s, each over a connection of its own, and the job's own pause when the
 * account can't be used. It runs only on beta and only with WebUntis credentials: one account
 * serves it, and two logins with it log each other out (AGENTS.md rule 2).
 */
import type { WebUntisConnection } from "@schnau/webuntis-api";
import type { System } from "@stu/api/System";
import { type School, Studienbuch } from "@stu/core";
import { SyncServer } from "@stu/sync/server";
import * as ClusterCron from "effect/cluster/ClusterCron";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import type * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import { Deployment } from "../infra/config/Deployment.ts";
import { Jobs } from "../infra/jobs/Jobs.ts";
import { LiveWebUntis } from "../infra/webuntis/LiveWebUntis.ts";
import { ImportRun } from "./ImportRun.ts";
import { Lease } from "./Lease.ts";
import { IgsLilienthal } from "./profiles/IgsLilienthal.ts";
import type { SchoolProfile } from "./profiles/SchoolProfile.ts";

export * as ImportJob from "./ImportJob.ts";

/** The school the job imports, and when. */
export const school = { profile: IgsLilienthal.profile, schedule: IgsLilienthal.schedule };

/** The owner of the job's own pause. `import resume --by import` ends it. */
export const pausedBy = "import";

/**
 * How long a run may take from its claim to its outcome. The run ends its reading at the lease's
 * deadline; this also bounds the waits before and after, so a stuck run can't stop the cron, which
 * schedules the next run only when one ends.
 */
export const deadline = Duration.sum(Lease.deadline, Duration.minutes(1));

/** Whether this process runs the import, and why not. */
export type Registration = Data.TaggedEnum<{
  Registered: { readonly connection: WebUntisConnection };
  /** `STUDIENBUCH_JOBS` leaves the import out. */
  NotEnabled: {};
  NoCredentials: {};
  /** Beta's account is the only one, so no other environment logs in, credentials or not. */
  NotHere: { readonly environment: System.Environment };
}>;

export const Registration = Data.taggedEnum<Registration>();

export const registration = Effect.gen(function* () {
  const { environment } = yield* Deployment.Current;

  if (!(yield* Jobs.enabled).includes("import")) return Registration.NotEnabled();

  if (environment !== "beta") return Registration.NotHere({ environment });

  const credentials = yield* LiveWebUntis.credentials;

  if (Option.isNone(credentials)) return Registration.NoCredentials();

  return Registration.Registered({ connection: credentials.value });
});

/** The registration in words, for the log and `import status`. */
export const describe = Registration.$match({
  Registered: () => "registered",
  NotEnabled: () => "not registered: STUDIENBUCH_JOBS leaves it out",
  NoCredentials: () => "not registered: no WebUntis credentials",
  NotHere: ({ environment }) => `not registered: only beta imports, and this is ${environment}`,
});

/**
 * Pauses the school's import after a refused password, which won't fix itself, and after the
 * second run in a row that lost its session, because someone uses the account without pausing
 * the import first. Runs that sent nothing don't break the row.
 */
const pauseAfter = Effect.fn("ImportJob.pauseAfter")(
  function* (school: School.Id, ran: ImportRun.Ran) {
    const sql = yield* SqlClient.SqlClient;
    const { outcome } = ran;

    if (outcome !== "CredentialsRefused") {
      // A session the nightly self-check lost after its publish counts as the run's own.
      const [own] = Option.isSome(ran.run)
        ? yield* sql<{ readonly lost: boolean }>`
            select self_check->>'reason' = 'SessionLost' as lost from import_run
            where id = ${ran.run.value}::uuid
          `
        : [];

      if (outcome !== "SessionLost" && own?.lost !== true) return;

      const recent = yield* sql<{ readonly outcome: string | null }>`
        select case when self_check->>'reason' = 'SessionLost' then 'SessionLost' else outcome end
          as outcome
        from import_run
        where school_id = ${school} and sent > 0
        order by started_at desc limit 2
      `;

      if (recent.length < 2 || recent.some((run) => run.outcome !== "SessionLost")) return;
    }

    // The run released its lease, so this returns at once.
    yield* Lease.pause(school, pausedBy);

    yield* Effect.logWarning(
      outcome === "CredentialsRefused"
        ? "The import paused itself: WebUntis refused the password"
        : "The import paused itself: two runs in a row lost their session",
    );
  },
  // Someone else's pause stops the import just as well.
  Effect.catchTags({
    "Lease.PausedByOther": () => Effect.void,
    "Lease.NotPausedBy": () => Effect.void,
    SqlError: Effect.die,
  }),
);

/**
 * One run of the job: the run over a fresh connection through `transport`, then the job's own pause
 * if the account can't be used.
 */
export const runOnce = Effect.fn("ImportJob.runOnce")(function* (input: {
  readonly profile: SchoolProfile.SchoolProfile;
  readonly run: SchoolProfile.Run;
  readonly connection: WebUntisConnection;
  readonly transport: Layer.Layer<HttpClient.HttpClient>;
}) {
  const { profile, run, connection, transport } = input;

  const ran = yield* ImportRun.run({
    profile,
    nightly: run.nightly,
    maximum: run.maximum,
    source: (gate) => LiveWebUntis.layer(connection, gate).pipe(Layer.provide(transport)),
  }).pipe(Effect.timeoutOption(deadline));

  if (Option.isNone(ran)) {
    yield* Effect.logWarning("An import run outlived the job's deadline and was stopped");

    return ran;
  }

  yield* pauseAfter(profile.id, ran.value);

  return ran;
});

/** The job's two crons where it is registered, and nothing elsewhere. */
export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const found = yield* registration;

    yield* Effect.logInfo(`The import job is ${describe(found)}`);

    if (found._tag !== "Registered") return Layer.empty;

    const { profile, schedule } = school;

    const cron = (name: string, run: SchoolProfile.Run) =>
      ClusterCron.make({
        name,
        cron: run.cron,
        // A backlog after downtime skips slot by slot instead of running them all at once.
        skipIfOlderThan: "5 minutes",
        execute: runOnce({
          profile,
          run,
          connection: found.connection,
          transport: LiveWebUntis.transport,
        }).pipe(Effect.andThen(Jobs.recordRun("import"))),
      });

    return Layer.mergeAll(
      cron("import-daytime", schedule.daytime),
      cron("import-nightly", schedule.nightly),
    ).pipe(Layer.provide(SyncServer.writers(Studienbuch.schema)));
  }),
);
