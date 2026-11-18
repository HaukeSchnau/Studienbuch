/**
 * One import run (m2-import-path.md, "The model"): lease, reservation, one snapshot, store, import,
 * and the school's rows with the checkpoint in one transaction, or nothing. It records its outcome
 * and never fails. What it records names reads by kind and failures by tag, never a body or a name.
 */
import { WebUntisClient, type WebUntisError } from "@schnau/webuntis-api";
import {
  AppDataSchema,
  ExamsSchema,
  SchoolyearSchema,
  TimeGridSchema,
  TimetableFilterSchema,
  type TimetableResourceType,
} from "@schnau/webuntis-api/schemas";
import { CivilTime, School } from "@stu/core";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { RecordedWebUntis } from "../infra/webuntis/RecordedWebUntis.ts";
import { Schools } from "../school/Schools.ts";
import { Policy } from "./corpus/Policy.ts";
import { ImportIds } from "./ImportIds.ts";
import { Lease } from "./Lease.ts";
import { NaiveImport } from "./NaiveImport.ts";
import { Plan } from "./Plan.ts";
import type { SchoolProfile } from "./profiles/SchoolProfile.ts";
import { Projection } from "./Projection.ts";
import { SchoolImport } from "./SchoolImport.ts";
import { SourceStore } from "./source/SourceStore.ts";

export * as ImportRun from "./ImportRun.ts";

/**
 * Requests a school's import may reserve in one school-local day. The cap counts the import's
 * runs only, not live tests or captures, which pause it.
 */
export const dailyCap = 3000;

/** How much newer a snapshot must be before the Stand moves, because each write wakes every device. */
export const statusStep = Duration.minutes(30);

export interface Options {
  readonly profile: SchoolProfile.SchoolProfile;
  /** The nightly run, which alone creates courses and offerings. */
  readonly nightly: boolean;
  /** The most requests the run may send, reserved before its first. */
  readonly maximum: number;
  /** A connection to WebUntis for this run alone, built once its requests are reserved. */
  readonly source: Layer.Layer<WebUntisClient, WebUntisError>;
}

export const Outcome = Schema.Literals([
  /** The snapshot's rows, checkpoint and Stand are published. */
  "Published",
  /** The checkpoint moved and no row was written, because the profile doesn't publish yet. */
  "Dark",
  /** A read failed, so the run published nothing. */
  "Incomplete",
  /** Another run's checkpoint landed first, so this one rolled back. */
  "Superseded",
  /** The lease's deadline came first. */
  "TimedOut",
  /** The import or the publish failed. Nothing was published. */
  "Failed",
  /** Another run held the lease. */
  "Busy",
  /** The import is paused. */
  "Paused",
  /** The day's requests are reserved already. */
  "OverBudget",
]);

export type Outcome = typeof Outcome.Type;

const Counts = Schema.Struct({ written: Schema.Int, removed: Schema.Int });

/** What a run did, in counts, read kinds, field paths and tags. */
export const Report = Schema.Struct({
  /** Reads by kind, such as `<year>/entries/CLASS/<id>`, and how they went. */
  reads: Schema.Record(Schema.String, Schema.Struct({ ok: Schema.Int, failed: Schema.Int })),
  /** Failed reads by error tag. */
  failures: Schema.Record(Schema.String, Schema.Int),
  /** Fields of the reads that no rule names, which the store dropped, by read kind and path. */
  drift: Schema.Array(Schema.String),
  versionsStored: Schema.Int,
  versionsPruned: Schema.Int,
  /** Rows the publish wrote and removed, by table. */
  rows: Schema.Record(Schema.String, Counts),
  /** Lessons and closures waiting for the next snapshot. */
  pending: Schema.Int,
  unattributed: Schema.Int,
  /** Rows their tables refused, which stayed out of the publish. */
  rejected: Schema.Int,
  /** Reads the import asked for that the run's snapshot lacked: a plan the import outgrew. */
  unplanned: Schema.Array(Schema.String),
  /** The tag of a failure that ended the run, never its message, which can quote a value. */
  failure: Schema.optional(Schema.String),
});

export type Report = typeof Report.Type;

const encodeReport = Schema.encodeEffect(Schema.fromJsonString(Report));
const decodeOutcome = Schema.decodeUnknownEffect(Outcome);

const emptyReport: Report = {
  reads: {},
  failures: {},
  drift: [],
  versionsStored: 0,
  versionsPruned: 0,
  rows: {},
  pending: 0,
  unattributed: 0,
  rejected: 0,
  unplanned: [],
};

export interface Ran {
  readonly outcome: Outcome;
  /** The run's row, absent when it never got the lease. */
  readonly run: Option.Option<string>;
  readonly report: Report;
}

/** A request past the reservation, refused before it was sent. */
export class OverReservation extends Schema.TaggedError<
  OverReservation,
  { readonly brand: unique symbol }
>()("ImportRun.OverReservation", {}) {}

/** A request after the lease's deadline, refused before it was sent. */
export class PastDeadline extends Schema.TaggedError<
  PastDeadline,
  { readonly brand: unique symbol }
>()("ImportRun.PastDeadline", {}) {}

/** Another run's checkpoint landed after this run read its own. */
class Superseded extends Schema.TaggedError<Superseded, { readonly brand: unique symbol }>()(
  "ImportRun.Superseded",
  {},
) {}

/** WebUntis answered a timetable with errors, so it may lack lessons it didn't say it lacks. */
class AnsweredWithErrors extends Schema.TaggedError<
  AnsweredWithErrors,
  { readonly brand: unique symbol }
>()("ImportRun.AnsweredWithErrors", {}) {}

/** A read that failed, so the snapshot is incomplete. */
class ReadFailed extends Schema.TaggedError<ReadFailed, { readonly brand: unique symbol }>()(
  "ImportRun.ReadFailed",
  {},
) {}

/**
 * Admits one request at a time while the run is within its reservation and before its lease's
 * deadline, and counts what it admitted. Every request is checked before it is sent.
 */
export const dispatch = Effect.fn("ImportRun.dispatch")(function* (
  reserved: number,
  until: DateTime.Utc,
) {
  const sent = yield* Ref.make(0);

  const admit = Effect.gen(function* () {
    if (!DateTime.isLessThan(yield* DateTime.now, until)) return yield* new PastDeadline();

    const admitted = yield* Ref.modify(sent, (count) =>
      count < reserved ? [true, count + 1] : [false, count],
    );

    if (!admitted) return yield* new OverReservation();
  });

  return { admit, sent: Ref.get(sent) };
});

interface Tagged {
  readonly _tag: string;
}

const tagOf = (error: Tagged) => error._tag;

/** The budget's lock, until the transaction ends. */
const holdBudget = (school: School.Id) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) =>
      sql`select pg_advisory_xact_lock(hashtextextended(${`studienbuch.import-budget:${school}`}, 0))`,
  );

/**
 * Writes the run's row with its reservation, if the school's reservations of `date` stay within
 * the cap, and otherwise one that reserves nothing. Reservations of one school take turns, so two
 * runs can't both take the day's last requests.
 */
export const reserve = Effect.fn("ImportRun.reserve")(function* (input: {
  readonly school: School.Id;
  readonly date: CivilTime.PlainDate;
  readonly nightly: boolean;
  readonly maximum: number;
  readonly startedAt: DateTime.Utc;
}) {
  const sql = yield* SqlClient.SqlClient;
  const date = CivilTime.format(input.date);
  const startedAt = DateTime.toDateUtc(input.startedAt);

  return yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* holdBudget(input.school);

      const [used] = yield* sql<{ readonly reserved: number }>`
          select coalesce(sum(reserved), 0)::int as reserved from import_run
          where school_id = ${input.school} and date = ${date}::date
        `;

      const fits = (used?.reserved ?? 0) + input.maximum <= dailyCap;

      const [row] = yield* sql<{ readonly id: string }>`
          insert into import_run (id, school_id, date, nightly, started_at, reserved, outcome, ended_at)
          values (
            gen_random_uuid(), ${input.school}, ${date}::date, ${input.nightly}, ${startedAt},
            ${fits ? input.maximum : 0}, ${fits ? null : "OverBudget"}, ${fits ? null : startedAt}
          )
          returning id::text as id
        `;

      return { id: row?.id ?? "", fits };
    }),
  );
}, Effect.orDie);

const json = <S extends Schema.Top>(schema: S) => Schema.encodeEffect(Schema.toCodecJson(schema));

const encodeYears = json(Schema.Array(SchoolyearSchema));
const encodeAppData = json(AppDataSchema);
const encodeTimeGrid = json(TimeGridSchema);
const encodeFilter = json(TimetableFilterSchema);
const encodeExams = json(ExamsSchema);
const decodeJson = Schema.decodeUnknownEffect(Schema.Json);
const decodeDate = Schema.decodeOption(CivilTime.PlainDate);
const ImportResultJson = Schema.toCodecJson(SchoolImport.ImportResult);
const decodePrevious = Schema.decodeUnknownEffect(ImportResultJson);

const decodePending = Schema.decodeUnknownEffect(
  Schema.toCodecJson(Schema.Array(Projection.Candidate)),
);

const encodePrevious = Schema.encodeEffect(Schema.fromJsonString(SchoolImport.ImportResult));

const encodePending = Schema.encodeEffect(
  Schema.fromJsonString(Schema.Array(Projection.Candidate)),
);

const directories = [
  "CLASS",
  "TEACHER",
  "SUBJECT",
  "ROOM",
] as const satisfies ReadonlyArray<TimetableResourceType>;

/**
 * Reads the plan's views for the window, each request admitted by `admit`, and returns every read
 * that answered, as JSON, and every one that didn't, by kind and tag. A read the plan depends on,
 * such as the school years, ends the reading when it fails.
 */
const readSnapshot = Effect.fn("ImportRun.readSnapshot")(function* (input: {
  readonly client: WebUntisClient["Service"];
  readonly admit: Effect.Effect<void, OverReservation | PastDeadline>;
  readonly profile: SchoolProfile.SchoolProfile;
  readonly previous: SchoolImport.ImportResult;
  readonly window: CivilTime.DateRange;
}) {
  const { client, admit, profile, previous } = input;
  const reads: Array<SourceStore.Read> = [];
  const failures: Array<{ readonly read: string; readonly tag: string }> = [];

  const read = <A, E1 extends Tagged, E2 extends Tagged>(
    path: string,
    request: Effect.Effect<A, E1>,
    toJson: (value: A) => Effect.Effect<Schema.Json, E2>,
    range?: SourceStore.Read["range"],
  ) =>
    admit.pipe(
      Effect.andThen(request),
      Effect.flatMap((value) => Effect.map(toJson(value), (body) => ({ value, body }))),
      Effect.matchEffect({
        onFailure: (error) =>
          Effect.sync(() => {
            failures.push({ read: Policy.readKind(path), tag: tagOf(error) });

            return Option.none<A>();
          }),
        onSuccess: ({ value, body }) =>
          Effect.sync(() => {
            reads.push(range === undefined ? { path, body } : { path, range, body });

            return Option.some(value);
          }),
      }),
    );

  const done = { reads, failures };
  const { paths } = RecordedWebUntis;
  const years = yield* read(paths.schoolYears, client.schoolyears.list, encodeYears);
  const held = Option.flatMap(years, (all) => Plan.schoolYear(all, input.window));

  if (Option.isNone(held)) {
    if (Option.isSome(years)) failures.push({ read: "schoolyears", tag: "NoSchoolYear" });

    return done;
  }

  const { year, start, end, last } = held.value;
  const first = CivilTime.format(input.window.start);

  yield* read(paths.appData, client.app.getData, encodeAppData);
  yield* read(paths.timeGrid, client.timetable.getTimeGrid, encodeTimeGrid);

  const [classes] = yield* Effect.forEach(directories, (resourceType) =>
    read(
      paths.filter(year.id, resourceType),
      client.timetable.getFilter({ resourceType, start, end }),
      encodeFilter,
    ),
  );

  yield* read(paths.exams(year.id), client.exams.list({ start: first, end: last }), encodeExams);

  const yearStart = decodeDate(start);

  if (classes === undefined || Option.isNone(classes) || Option.isNone(yearStart)) return done;

  const views = Plan.classes({
    profile,
    previous,
    directory: classes.value.classes.map((each) => each.class),
    schoolYear: ImportIds.schoolYear(yearStart.value),
  });

  yield* Effect.forEach(
    views,
    (resource) =>
      read(
        paths.entries(year.id, "CLASS", resource),
        client.timetable
          .getEntriesForResources(
            { resourceType: "CLASS", resources: [resource], start: first, end: last },
            { raw: true },
          )
          .pipe(
            Effect.flatMap(
              ([answer]): Effect.Effect<
                unknown,
                ReadFailed | AnsweredWithErrors | WebUntisError
              > => {
                if (answer === undefined) return Effect.fail(new ReadFailed());

                if (Result.isFailure(answer.result)) return Effect.fail(answer.result.failure);

                return answer.result.success.errors.length > 0
                  ? Effect.fail(new AnsweredWithErrors())
                  : Effect.succeed(answer.raw);
              },
            ),
          ),
        decodeJson,
        { start: first, end: last },
      ),
    { concurrency: 2, discard: true },
  );

  return done;
});

/**
 * The last day of the unbroken run of days from today whose lessons the result read completely,
 * stepping over weekends, which WebUntis leaves out. The day before today when today isn't one.
 */
export const coveredFrom = (
  result: Pick<SchoolImport.ImportResult, "covers" | "unattributed">,
  window: CivilTime.DateRange,
) => {
  let covered = CivilTime.addDays(window.start, -1);

  for (
    let day = window.start;
    CivilTime.order(day, window.end) <= 0;
    day = CivilTime.addDays(day, 1)
  ) {
    if (
      CivilTime.dayOfWeek(day) <= 5 &&
      !SchoolImport.deletes(result, "lessons", CivilTime.format(day))
    ) {
      break;
    }

    covered = day;
  }

  return covered;
};

/** The import's identity state for the next run: everything but lessons before today. */
const identity = (state: SchoolImport.ImportResult, today: string): SchoolImport.ImportResult => {
  const lessons = state.lessons.filter(({ date }) => today <= date);
  const kept = new Set(lessons.map(({ id }) => id));
  const gone = new Set(state.lessons.flatMap(({ id }) => (kept.has(id) ? [] : [id])));

  return { ...state, lessons, links: state.links.filter(({ id }) => !gone.has(id)) };
};

/**
 * The Stand to publish, if it changes: `coveredUntil` never moves back while what a run published
 * still stands, so a daytime run can't take back days a nightly one covered, and `observedAt` moves
 * in steps.
 */
const statusOf = (
  published: Option.Option<{
    readonly observedAt: DateTime.Utc;
    readonly coveredUntil: CivilTime.PlainDate;
  }>,
  now: DateTime.Utc,
  covered: CivilTime.PlainDate,
) => {
  const observedAt = DateTime.formatIso(now);

  if (Option.isNone(published)) {
    return Option.some({ observedAt, coveredUntil: CivilTime.format(covered) });
  }

  const before = published.value;

  const coveredUntil =
    CivilTime.order(before.coveredUntil, covered) < 0 ? covered : before.coveredUntil;

  const moved = CivilTime.order(coveredUntil, before.coveredUntil) !== 0;

  const stepped = !DateTime.isLessThan(now, DateTime.addDuration(before.observedAt, statusStep));

  return moved || stepped
    ? Option.some({ observedAt, coveredUntil: CivilTime.format(coveredUntil) })
    : Option.none();
};

/**
 * Records the run's outcome once, and returns the one recorded: a publish whose commit completed
 * while its deadline interrupted it stays published.
 */
const finish = Effect.fn("ImportRun.finish")(function* (
  run: string,
  outcome: Outcome,
  sent: number,
  report: Report,
) {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{ readonly outcome: string }>`
    with finished as (
      update import_run
      set outcome = ${outcome}, ended_at = ${DateTime.toDateUtc(yield* DateTime.now)},
        sent = ${sent}, report = ${yield* encodeReport(report)}::jsonb
      where id = ${run}::uuid and outcome is null
      returning outcome
    )
    select outcome from finished
    union all
    select outcome from import_run where id = ${run}::uuid and not exists (select 1 from finished)
  `;

  return yield* decodeOutcome(row?.outcome ?? outcome);
}, Effect.orDie);

/** The run after it holds the lease and its requests. */
const leased = Effect.fn("ImportRun.leased")(function* (
  options: Options,
  lease: Lease.Claim,
  run: string,
  requests: {
    readonly admit: Effect.Effect<void, OverReservation | PastDeadline>;
    readonly sent: Effect.Effect<number>;
  },
  report: Ref.Ref<Report>,
) {
  const sql = yield* SqlClient.SqlClient;
  const { profile } = options;
  const school = profile.id;

  const previous = Option.isNone(Option.fromNullishOr(lease.previous))
    ? Option.none<SchoolImport.ImportResult>()
    : Option.some(yield* decodePrevious(lease.previous));

  const pending = yield* decodePending(lease.pending);
  const now = yield* DateTime.now;
  const window = Plan.window(profile.school, now);
  const today = CivilTime.format(window.start);
  // Lessons before today never change, so neither the import nor the publish sees them.

  const known = identity(
    Option.getOrElse(previous, () => SchoolImport.empty),
    today,
  );

  const snapshot = yield* WebUntisClient.use((client) =>
    readSnapshot({ client, admit: requests.admit, profile, previous: known, window }),
  ).pipe(
    Effect.provide(options.source),
    Effect.catch((error) =>
      Effect.succeed({ reads: [], failures: [{ read: "connect", tag: tagOf(error) }] }),
    ),
  );

  // Reads that answered are stored even when another failed: the store is a log.
  const versions: Array<SourceStore.Version> = [];
  const drift = new Set<string>();
  const failures = [...snapshot.failures];

  for (const read of snapshot.reads) {
    const sanitized = SourceStore.sanitize(read);

    if (Result.isFailure(sanitized)) {
      failures.push({ read: Policy.readKind(read.path), tag: sanitized.failure._tag });
    } else {
      versions.push(...sanitized.success.versions);

      for (const path of sanitized.success.drift)
        drift.add(`${Policy.readKind(read.path)} ${path}`);
    }
  }

  const reads: Record<string, { ok: number; failed: number }> = {};

  for (const { path } of snapshot.reads) {
    const kind = Policy.readKind(path);

    reads[kind] = { ok: (reads[kind]?.ok ?? 0) + 1, failed: reads[kind]?.failed ?? 0 };
  }

  for (const { read } of failures) {
    reads[read] = { ok: reads[read]?.ok ?? 0, failed: (reads[read]?.failed ?? 0) + 1 };
  }

  const tags: Record<string, number> = {};

  for (const { tag } of failures) tags[tag] = (tags[tag] ?? 0) + 1;

  const versionsStored = yield* SourceStore.write(school, now, versions);
  const versionsPruned = yield* SourceStore.prune(school, profile.school.timeZone, now);

  yield* Ref.update(report, (current) => ({
    ...current,
    reads,
    failures: tags,
    drift: [...drift].sort(),
    versionsStored,
    versionsPruned,
  }));

  if (failures.length > 0) return "Incomplete" as const;

  // The import reads the stored form of the snapshot, so it can't need what the store drops.
  const recorded = yield* RecordedWebUntis.make(
    SourceStore.recordingOf(versions.map((version) => ({ ...version, observedAt: now }))),
    { asOf: now },
  );

  const result = yield* SchoolImport.Service.use((service) =>
    service.run({
      profile,
      now,
      window,
      previous: Option.map(previous, () => known),
      nightly: options.nightly,
    }),
  ).pipe(
    Effect.provide(
      NaiveImport.layer.pipe(Layer.provide(Layer.succeed(WebUntisClient)(recorded.client))),
    ),
  );

  const projection = Projection.project({
    profile,
    previous: known,
    result,
    pending,
    today: window.start,
  });

  const next = { ...projection.state, diagnostics: [] };
  const log = yield* recorded.log;

  yield* Ref.update(report, (current) => ({
    ...current,
    pending: projection.pending.length,
    unattributed: result.unattributed.length,
    rejected: projection.rejected.length,
    unplanned: [...log.notCaptured, ...log.outOfRange],
  }));

  const nextJson = yield* encodePrevious(next);
  const pendingJson = yield* encodePending(projection.pending);
  const outcome: Outcome = profile.publish ? "Published" : "Dark";

  return yield* sql.withTransaction(
    Effect.gen(function* () {
      // The checkpoint's row stays locked until the commit, so no other run's lands in between.
      const [moved] = yield* sql`
        update import_school
        set revision = revision + 1, observed_at = ${DateTime.toDateUtc(now)},
          previous = ${nextJson}::jsonb, pending = ${pendingJson}::jsonb
        where school_id = ${school} and revision = ${lease.revision}
          and lease_owner = ${lease.owner}::uuid
          and lease_until > ${DateTime.toDateUtc(yield* DateTime.now)}
        returning 1
      `;

      if (moved === undefined) return yield* new Superseded();

      if (profile.publish) {
        const status = statusOf(
          yield* Schools.importStatus(school),
          now,
          coveredFrom(result, window),
        );

        const data = Option.isSome(status)
          ? { ...projection.data, importStatus: status.value }
          : projection.data;

        const rows = yield* Schools.publish(data, projection.removals);

        yield* Ref.update(report, (current) => ({ ...current, rows }));
      }

      return yield* finish(run, outcome, yield* requests.sent, yield* Ref.get(report));
    }),
  );
});

/**
 * Runs one import of the school: lease, reservation, snapshot, store, import, publish. It always
 * succeeds with its outcome, and records it on its run's row once it has one.
 */
export const run = Effect.fn("ImportRun.run")(function* (options: Options) {
  const school = options.profile.id;
  const claimed = yield* Effect.result(Lease.claim(school));

  if (Result.isFailure(claimed)) {
    const outcome: Outcome = claimed.failure._tag === "Lease.Busy" ? "Busy" : "Paused";

    return { outcome, run: Option.none(), report: emptyReport } satisfies Ran;
  }

  const lease = claimed.success;

  return yield* Effect.gen(function* () {
    const startedAt = yield* DateTime.now;

    const reservation = yield* reserve({
      school,
      date: School.today(options.profile.school, DateTime.toEpochMillis(startedAt)),
      nightly: options.nightly,
      maximum: options.maximum,
      startedAt,
    });

    if (!reservation.fits) {
      return {
        outcome: "OverBudget",
        run: Option.some(reservation.id),
        report: emptyReport,
      } satisfies Ran;
    }

    const requests = yield* dispatch(options.maximum, lease.until);
    const report = yield* Ref.make(emptyReport);
    const remaining = DateTime.distance(yield* DateTime.now, lease.until);

    const exit = yield* Effect.exit(
      leased(options, lease, reservation.id, requests, report).pipe(
        Effect.timeoutOrElse({
          duration: remaining,
          orElse: () => Effect.succeed("TimedOut" as const),
        }),
      ),
    );

    const error = Exit.isFailure(exit) ? Cause.findErrorOption(exit.cause) : Option.none();
    const superseded = Option.exists(error, Schema.is(Superseded));

    const outcome: Outcome = Exit.isSuccess(exit)
      ? exit.value
      : superseded
        ? "Superseded"
        : "Failed";

    const final = yield* Ref.get(report);

    const recorded =
      Exit.isFailure(exit) && !superseded
        ? { ...final, failure: Option.match(error, { onNone: () => "Defect", onSome: tagOf }) }
        : final;

    // A run that published wrote its row in the same transaction, and that outcome stands.
    const settled = yield* finish(reservation.id, outcome, yield* requests.sent, recorded);

    return { outcome: settled, run: Option.some(reservation.id), report: recorded } satisfies Ran;
  }).pipe(Effect.ensuring(Lease.release(school, lease.owner)));
});
