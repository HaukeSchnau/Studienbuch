/**
 * `console import`: the import's state, and the pause a live test or a capture takes around its
 * login (AGENTS.md rule 2). `pause` returns once no run reads WebUntis, and no run starts until
 * the same owner resumes. The console never connects to WebUntis itself.
 */
import { CivilTime, School } from "@stu/core";
import * as CliError from "effect/cli/CliError";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { ImportJob } from "./ImportJob.ts";
import { ImportRun } from "./ImportRun.ts";
import { Lease } from "./Lease.ts";

export * as ImportCommand from "./ImportCommand.ts";

const { profile } = ImportJob.school;

/** The pause belongs to someone else, or to no one. The CLI prints its message alone. */
export class Refused extends Schema.TaggedError<Refused, { readonly brand: unique symbol }>()(
  "ImportCommand.Refused",
  { message: Schema.String },
) {
  override get [CliError.userMessage]() {
    return this.message;
  }
}

const iso = (date: Date | null) =>
  date === null ? "never" : DateTime.formatIso(DateTime.fromDateUnsafe(date));

/** What `import status` prints: where the job runs, the pause and lease, today's budget, the last runs. */
export const status = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* DateTime.now;
  const registration = yield* ImportJob.registration;
  const today = CivilTime.format(School.today(profile.school, DateTime.toEpochMillis(now)));

  const [state] = yield* sql<{
    readonly pausedBy: string | null;
    readonly pausedAt: Date | null;
    readonly leaseUntil: Date | null;
    readonly revision: number;
    readonly observedAt: Date | null;
  }>`
    select paused_by as "pausedBy", paused_at as "pausedAt", lease_until as "leaseUntil",
      revision, observed_at as "observedAt"
    from import_school where school_id = ${profile.id}
  `;

  const [budget] = yield* sql<{ readonly reserved: number; readonly runs: number }>`
    select coalesce(sum(reserved), 0)::int as reserved, count(*)::int as runs
    from import_run where school_id = ${profile.id} and date = ${today}::date
  `;

  const runs = yield* sql<{
    readonly startedAt: Date;
    readonly nightly: boolean;
    readonly outcome: string | null;
    readonly sent: number;
    readonly reserved: number;
  }>`
    select started_at as "startedAt", nightly, outcome, sent, reserved
    from import_run where school_id = ${profile.id}
    order by started_at desc limit 5
  `;

  const leased =
    state?.leaseUntil !== undefined &&
    state.leaseUntil !== null &&
    DateTime.isLessThan(now, DateTime.fromDateUnsafe(state.leaseUntil));

  const lines = [
    `school      ${profile.id}`,
    `job         ${ImportJob.describe(registration)}`,
    `publish     ${profile.publish ? "on" : "off: runs keep their checkpoint and write no row"}`,
    `paused      ${
      state?.pausedBy === null || state === undefined
        ? "no"
        : `by ${state.pausedBy} since ${iso(state.pausedAt)}`
    }`,
    `reading     ${leased ? `a run holds the lease until ${iso(state?.leaseUntil ?? null)}` : "no"}`,
    `checkpoint  revision ${state?.revision ?? 0}, snapshot of ${iso(state?.observedAt ?? null)}`,
    `today       ${today}: ${budget?.reserved ?? 0} of ${ImportRun.dailyCap} requests reserved by ${budget?.runs ?? 0} runs`,
    ...(runs.length === 0
      ? ["last runs   none"]
      : [
          "last runs",
          ...runs.map(
            (run) =>
              `  ${iso(run.startedAt)} ${run.nightly ? "nightly" : "daytime"} ${run.outcome ?? "running or died"}, ${run.sent} of ${run.reserved} requests`,
          ),
        ]),
  ];

  return lines;
});

const by = Flag.String("by").pipe(
  Flag.withDescription("Who pauses, such as a live test's ref. Only they resume."),
);

export const command = Command.make("import").pipe(
  Command.withDescription("The WebUntis import: its state, and its pause around a live login"),
  Command.withSubcommands([
    Command.make("status", {}, () =>
      Effect.flatMap(status, (lines) => Console.log(lines.join("\n"))),
    ).pipe(Command.withDescription("Where the job runs, its pause, today's budget, the last runs")),
    Command.make("pause", { by }, (flags) =>
      Lease.pause(profile.id, flags.by).pipe(
        Effect.andThen(
          Console.log(
            `Paused by ${flags.by}. No run reads WebUntis now, and none starts until \`import resume --by ${flags.by}\`.`,
          ),
        ),
        Effect.catchTags({
          "Lease.PausedByOther": ({ by: holder }) =>
            new Refused({ message: `${holder} holds the pause; only they resume it` }),
          "Lease.NotPausedBy": () =>
            new Refused({ message: `${flags.by}'s pause was resumed while it waited` }),
        }),
      ),
    ).pipe(
      Command.withDescription(
        "Pauses the import and waits until no run reads, at most five minutes. Take it before any live login",
      ),
    ),
    Command.make("resume", { by }, (flags) =>
      Lease.resume(profile.id, flags.by).pipe(
        Effect.andThen(Console.log(`Resumed: ${flags.by}'s pause is over.`)),
        Effect.catchTags({
          "Lease.NotPausedBy": () =>
            new Refused({ message: `${flags.by} holds no pause, so nothing was resumed` }),
        }),
      ),
    ).pipe(
      Command.withDescription(
        `Ends your own pause. The job's own pause, after a refused password or lost sessions, is \`--by ${ImportJob.pausedBy}\``,
      ),
    ),
  ]),
);
