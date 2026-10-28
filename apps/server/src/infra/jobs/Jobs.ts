import * as ClusterCron from "effect/cluster/ClusterCron";
import * as SingleRunner from "effect/cluster/SingleRunner";
import * as Config from "effect/Config";
import * as Cron from "effect/Cron";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { Database } from "../database/Database.ts";
import { Schema as Tables } from "../database/Schema.ts";

/** Every job the server knows. */
export const Name = Schema.Literals(["heartbeat"]);

export type Name = typeof Name.Type;

/**
 * The jobs this process runs: `STUDIENBUCH_JOBS` as a comma list or `none`, every job when unset.
 * Running jobs in a second process later means setting it on two services (ADR 0011).
 */
export const enabled = Config.Literal("none", "STUDIENBUCH_JOBS").pipe(
  Config.map((): ReadonlyArray<Name> => []),
  Config.orElse(() => Config.Array(Name, "STUDIENBUCH_JOBS")),
  Config.withDefault(Name.literals),
);

const recordRun = Effect.fn("Jobs.recordRun")(function* (name: Name) {
  const db = yield* Database.Drizzle;
  const lastRunAt = DateTime.toDateUtc(yield* DateTime.now);
  yield* db
    .insert(Tables.jobRun)
    .values({ name, lastRunAt })
    .onConflictDoUpdate({ target: Tables.jobRun.name, set: { lastRunAt } });
});

/** When each job last ran, from any process. */
export const lastRuns = Effect.gen(function* () {
  const db = yield* Database.Drizzle;
  const rows = yield* db.select().from(Tables.jobRun);

  return new Map(rows.map((row) => [row.name, DateTime.fromDateUnsafe(row.lastRunAt)]));
});

const jobs = {
  // Proves the cluster modules on the real host before sync and import jobs depend on them.
  heartbeat: ClusterCron.make({
    name: "heartbeat",
    cron: Cron.parseUnsafe("* * * * *"),
    execute: recordRun("heartbeat"),
  }),
} satisfies Record<Name, ReturnType<typeof ClusterCron.make>>;

/**
 * Runs the enabled jobs through `ClusterCron` on a single-node cluster in Postgres, so runs never
 * overlap across processes. Effect creates and migrates its `cluster_*` tables itself.
 */
export const layer = Layer.unwrap(
  Effect.map(enabled, (names) => {
    const [first, ...rest] = names.map((name) => jobs[name]);

    return first === undefined
      ? Layer.empty
      : Layer.mergeAll(first, ...rest).pipe(Layer.provide(SingleRunner.layer()));
  }),
);

export * as Jobs from "./Jobs.ts";
