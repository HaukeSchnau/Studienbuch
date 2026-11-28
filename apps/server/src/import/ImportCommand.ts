/**
 * `console import`: the import's state, the pause a live test or a capture takes around its login
 * (AGENTS.md rule 2), and the store's export into the corpus. `pause` returns once no run reads
 * WebUntis, and no run starts until the same owner resumes. The console never connects to WebUntis.
 */
import { CivilTime, School } from "@stu/core";
import * as CliError from "effect/cli/CliError";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Export } from "./corpus/Export.ts";
import { ImportJob } from "./ImportJob.ts";
import { ImportRun } from "./ImportRun.ts";
import { Lease } from "./Lease.ts";
import { SelfCheck } from "./SelfCheck.ts";

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

const decodeSelfCheck = Schema.decodeUnknownEffect(Schema.toCodecJson(SelfCheck.Result));

/** The last self-check's headline numbers and course identity, each against its threshold. */
const selfCheckLines = (startedAt: string, result: SelfCheck.Result) => {
  if (result._tag === "NotMeasured") {
    return [`self-check  of the run at ${startedAt} measured nothing: ${result.reason}`];
  }

  const measures = SelfCheck.measures(result, profile.thresholds);
  const width = Math.max(...measures.map(({ label }) => label.length));
  const { courseIdentity: identity } = result;

  return [
    `self-check  of the run at ${startedAt}: ${result.students} students, ${result.chosen} Kurswahlen taken, ${result.hiddenDays} days hidden; thresholds gate nothing until go 2`,
    ...measures.map(
      ({ label, value, threshold, clears }) =>
        `  ${label.padEnd(width)}  ${value}, ${threshold}${clears ? "" : ", below"}`,
    ),
    `  course identity: ${identity.split} of ${identity.realCourses} real courses split, ${identity.merged} of our ${identity.ourCourses} merge real ones`,
  ];
};

/**
 * What `import status` prints: where the job runs, the pause and lease, the last retention sweep,
 * today's budget, the last self-check and the last runs.
 */
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

  const [checked] = yield* sql<{ readonly startedAt: Date; readonly selfCheck: unknown }>`
    select started_at as "startedAt", self_check as "selfCheck"
    from import_run where school_id = ${profile.id} and self_check is not null
    order by started_at desc limit 1
  `;

  const [swept] = yield* sql<{
    readonly sweptAt: Date;
    readonly lessons: number | null;
    readonly checkpoint: number | null;
    readonly versions: number | null;
    readonly failure: string | null;
  }>`
    select swept_at as "sweptAt", lessons, checkpoint, versions, failure
    from retention_sweep where school_id = ${profile.id}
  `;

  const sweptLine =
    swept === undefined
      ? "swept       not yet"
      : swept.failure === null
        ? `swept       ${iso(swept.sweptAt)}: ${swept.lessons} lessons, ${swept.checkpoint} from the checkpoint, ${swept.versions} raw reads`
        : `swept       ${iso(swept.sweptAt)} failed: ${swept.failure}`;

  const selfCheck =
    checked === undefined
      ? ["self-check  none yet"]
      : selfCheckLines(iso(checked.startedAt), yield* decodeSelfCheck(checked.selfCheck));

  const [exported] = yield* sql<{
    readonly startedAt: Date;
    readonly outcome: string | null;
    readonly report: unknown;
  }>`
    select started_at as "startedAt", outcome, report from import_export
    where school_id = ${profile.id} order by started_at desc limit 1
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
    sweptLine,
    `today       ${today}: ${budget?.reserved ?? 0} of ${ImportRun.dailyCap} requests reserved by ${budget?.runs ?? 0} runs`,
    ...selfCheck,
    ...(runs.length === 0
      ? ["last runs   none"]
      : [
          "last runs",
          ...runs.map(
            (run) =>
              `  ${iso(run.startedAt)} ${run.nightly ? "nightly" : "daytime"} ${run.outcome ?? "running or died"}, ${run.sent} of ${run.reserved} requests`,
          ),
        ]),
    ...lastExport(exported),
  ];

  return lines;
});

const decodeExport = Schema.decodeUnknownOption(Schema.Union([Export.Pushed, Export.Failure]));

/** What an export pushed: the archive, its size, hash and commit, its counts and its checks. */
const pushedLines = (pushed: Export.Pushed) => {
  const days = pushed.counts.ranges.map(({ start, end }) => `${start} to ${end}`).join(", ");

  return [
    `  ${pushed.archive}, ${Math.ceil(pushed.bytes / 1024)} KiB, SHA-256 ${pushed.sha256}`,
    `  commit ${pushed.commit ?? "none"}, observations after ${pushed.since} up to ${pushed.until}`,
    `  ${pushed.counts.reads} reads, ${pushed.counts.versions} versions, days ${days || "none"}`,
    `  policy ${pushed.policy}, ${pushed.key} key, ${pushed.counts.vocabulary} words and ${pushed.counts.phrases} phrases kept`,
    `  checks passed: ${pushed.checks.join(", ")}`,
  ];
};

/** The last export, which `import status` shows: what it pushed, or why it pushed nothing. */
const lastExport = (
  row:
    | { readonly startedAt: Date; readonly outcome: string | null; readonly report: unknown }
    | undefined,
) => {
  if (row === undefined) return ["last export none"];

  const at = iso(row.startedAt);
  const report = decodeExport(row.report);

  if (row.outcome === null) return [`last export ${at} running or died`];

  if (Option.isSome(report) && "sha256" in report.value) {
    return [`last export ${at} pushed`, ...pushedLines(report.value)];
  }

  const problems =
    Option.isSome(report) && "problems" in report.value && report.value.problems !== undefined
      ? `, ${report.value.problems} problems`
      : "";

  if (row.outcome === "Export.Forgotten") {
    return [
      `last export ${at} pushed nothing: it ran too late, and the source store may have pruned what its week showed at its start`,
    ];
  }

  if (row.outcome === "Gitea.CommitUnconfirmed") {
    return [
      `last export ${at} unconfirmed: Gitea didn't confirm the commit, so the corpus repository may hold it`,
    ];
  }

  return [`last export ${at} pushed nothing: ${row.outcome}${problems}`];
};

const by = Flag.String("by").pipe(
  Flag.withDescription("Who pauses, such as a live test's ref. Only they resume."),
);

export const command = Command.make("import").pipe(
  Command.withDescription(
    "The WebUntis import: its state, its pause around a live login, and its export into the corpus",
  ),
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
    Command.make("export", {}, () =>
      Effect.gen(function* () {
        const token = yield* Export.pushToken;

        if (Option.isNone(token)) {
          return yield* new Refused({ message: "CORPUS_PUSH_TOKEN is unset; only beta exports" });
        }

        const pushed = yield* Export.run({
          profile,
          until: yield* DateTime.now,
          recipients: Export.recipients,
        }).pipe(Effect.provide(ImportJob.corpusRepository(token.value)));

        yield* Console.log(["Pushed", ...pushedLines(pushed)].join("\n"));
      }),
    ).pipe(
      Command.withDescription(
        `Exports the store's last ${Export.days} days into the corpus repository now, as the weekly job does`,
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
