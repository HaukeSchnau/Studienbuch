/**
 * One import run (m2-import-path.md, "The model"): lease, reservation, one snapshot, store, import,
 * and the school's rows with the checkpoint in one transaction, or nothing. It records its outcome
 * and never fails. What it records names reads by kind and failures by tag, never a body or a name.
 */
import {
  type ConfigurationError,
  WebUntisClient,
  type WebUntisError,
  withSchoolYear,
} from "@schnau/webuntis-api";
import {
  AppDataSchema,
  ExamsSchema,
  SchoolyearSchema,
  TimeGridSchema,
  TimetableFilterSchema,
  type TimetableResourceType,
} from "@schnau/webuntis-api/schemas";
import { CivilTime, School } from "@stu/core";
import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
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
import type { LiveWebUntis } from "../infra/webuntis/LiveWebUntis.ts";
import { RecordedWebUntis } from "../infra/webuntis/RecordedWebUntis.ts";
import { Schools } from "../school/Schools.ts";
import { Policy } from "./corpus/Policy.ts";
import { Metrics } from "./evaluation/Metrics.ts";
import { Truth } from "./evaluation/Truth.ts";
import { ImportIds } from "./ImportIds.ts";
import { Lease } from "./Lease.ts";
import { NaiveImport } from "./NaiveImport.ts";
import { Plan } from "./Plan.ts";
import { SchoolProfile } from "./profiles/SchoolProfile.ts";
import { Projection } from "./Projection.ts";
import { SchoolImport } from "./SchoolImport.ts";
import { SelfCheck } from "./SelfCheck.ts";
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
  /**
   * A connection to WebUntis for this run alone, built once its requests are reserved. It sends
   * each request through `gate`, which refuses it past the reservation, the deadline or a lost
   * session.
   */
  readonly source: (
    gate: LiveWebUntis.Gate<Refused>,
  ) => Layer.Layer<WebUntisClient, WebUntisError | ConfigurationError>;
}

export const Outcome = Schema.Literals([
  /** The snapshot's rows, checkpoint and Stand are published. */
  "Published",
  /** The checkpoint moved and no row was written, because the profile doesn't publish yet. */
  "Dark",
  /** A read failed, so the run published nothing. */
  "Incomplete",
  /**
   * WebUntis ended the session, or the run would have had to log in again: someone else may use
   * the account. Nothing was sent after it, and nothing published.
   */
  "SessionLost",
  /** WebUntis refused the password. Nothing was published. */
  "CredentialsRefused",
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

/** A request after the lease's deadline or the reservation's day, refused before it was sent. */
export class PastDeadline extends Schema.TaggedError<
  PastDeadline,
  { readonly brand: unique symbol }
>()("ImportRun.PastDeadline", {}) {}

/** A request after the session was lost, refused before it was sent. */
export class SessionLost extends Schema.TaggedError<
  SessionLost,
  { readonly brand: unique symbol }
>()("ImportRun.SessionLost", {}) {}

/** Why a request stayed unsent. */
export type Refused = OverReservation | PastDeadline | SessionLost;

/** The plan has more views than the reservation has requests left, so none of them is read. */
class PlanTooLarge extends Schema.TaggedError<PlanTooLarge, { readonly brand: unique symbol }>()(
  "ImportRun.PlanTooLarge",
  {},
) {}

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
 * Admits one request at a time while the run is within its reservation, before `until` and while
 * its session holds, and counts what it admitted. Every request is checked before it is sent.
 */
export const dispatch = Effect.fn("ImportRun.dispatch")(function* (
  reserved: number,
  until: DateTime.Utc,
) {
  const sent = yield* Ref.make(0);
  const lost = yield* Ref.make(false);
  const refused = yield* Ref.make(false);

  const admit = Effect.gen(function* () {
    if (yield* Ref.get(lost)) return yield* new SessionLost();

    if (!DateTime.isLessThan(yield* DateTime.now, until)) return yield* new PastDeadline();

    const admitted = yield* Ref.modify(sent, (count) =>
      count < reserved ? [true, count + 1] : [false, count],
    );

    if (!admitted) return yield* new OverReservation();
  });

  return {
    gate: { admit, lose: Ref.set(lost, true) } satisfies LiveWebUntis.Gate<Refused>,
    /** WebUntis refused the password. */
    refuse: Ref.set(refused, true),
    /** What the account did to the run. It outranks any outcome the run reached after it. */
    account: Effect.map(
      Effect.all([Ref.get(refused), Ref.get(lost)]),
      ([isRefused, isLost]): Option.Option<Outcome> =>
        isRefused
          ? Option.some("CredentialsRefused")
          : isLost
            ? Option.some("SessionLost")
            : Option.none(),
    ),
    sent: Ref.get(sent),
  };
});

/**
 * When the school's date at `instant` ends. A run's reservation counts against that date, so its
 * requests stop there.
 */
export const endOfDay = (school: School.Row, instant: DateTime.Utc) =>
  DateTime.toUtc(
    DateTime.startOf(
      DateTime.add(DateTime.makeZonedUnsafe(instant, { timeZone: school.timeZone }), { days: 1 }),
      "day",
    ),
  );

/** Until when a run that started at `startedAt` may send: its lease's end, or its day's. */
export const sendsUntil = (school: School.Row, startedAt: DateTime.Utc, leaseUntil: DateTime.Utc) =>
  DateTime.min(leaseUntil, endOfDay(school, startedAt));

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

interface Failure {
  readonly read: string;
  readonly tag: string;
}

/** Collects the reads that answered, as JSON, and the ones that didn't, by kind and tag. */
const reader = () => {
  const reads: Array<SourceStore.Read> = [];
  const failures: Array<Failure> = [];

  const read = <A, E1 extends Tagged, E2 extends Tagged>(
    path: string,
    request: Effect.Effect<A, E1>,
    toJson: (value: A) => Effect.Effect<Schema.Json, E2>,
    range?: SourceStore.Read["range"],
  ) =>
    request.pipe(
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

  return { reads, failures, read };
};

/** The school year a run reads, and the days of the window within it. */
interface YearRead {
  readonly id: number;
  /** The year's first and last day, which its directories are read for. */
  readonly start: string;
  readonly end: string;
  /** The window's first and last day within the year. */
  readonly first: string;
  readonly last: string;
}

/**
 * One view of the window as WebUntis sent it. An answer with WebUntis's errors fails, because it
 * may lack lessons it doesn't say it lacks.
 */
const viewRead = (
  read: ReturnType<typeof reader>["read"],
  client: WebUntisClient["Service"],
  year: YearRead,
  resourceType: "CLASS" | "STUDENT",
  resource: number,
) =>
  read(
    RecordedWebUntis.paths.entries(year.id, resourceType, resource),
    withSchoolYear(year.id)(
      client.timetable.getEntriesForResources(
        { resourceType, resources: [resource], start: year.first, end: year.last },
        { raw: true },
      ),
    ).pipe(
      Effect.flatMap(
        ([answer]): Effect.Effect<unknown, ReadFailed | AnsweredWithErrors | WebUntisError> => {
          if (answer === undefined) return Effect.fail(new ReadFailed());

          if (Result.isFailure(answer.result)) return Effect.fail(answer.result.failure);

          return answer.result.success.errors.length > 0
            ? Effect.fail(new AnsweredWithErrors())
            : Effect.succeed(answer.raw);
        },
      ),
    ),
    decodeJson,
    { start: year.first, end: year.last },
  );

/**
 * Reads the plan's views for the window and returns every read that answered, as JSON, and every
 * one that didn't, by kind and tag. A read the plan depends on, such as the school years, ends the
 * reading when it fails, and so do more class views than `left` requests.
 */
const readSnapshot = Effect.fn("ImportRun.readSnapshot")(function* (input: {
  readonly client: WebUntisClient["Service"];
  /** Requests the reservation has left. */
  readonly left: Effect.Effect<number>;
  readonly profile: SchoolProfile.SchoolProfile;
  readonly previous: SchoolImport.ImportResult;
  readonly window: CivilTime.DateRange;
}) {
  const { client, profile, previous } = input;
  const { reads, failures, read } = reader();
  const { paths } = RecordedWebUntis;
  const years = yield* read(paths.schoolYears, client.schoolyears.list, encodeYears);
  const held = Option.flatMap(years, (all) => Plan.schoolYear(all, input.window));

  if (Option.isNone(held)) {
    if (Option.isSome(years)) failures.push({ read: "schoolyears", tag: "NoSchoolYear" });

    return { reads, failures, year: Option.none<YearRead>() };
  }

  const { year, start, end, last } = held.value;
  const first = CivilTime.format(input.window.start);
  const yearRead: YearRead = { id: year.id, start, end, first, last };
  const done = { reads, failures, year: Option.some(yearRead) };
  // WebUntis answers for the year a request names, else for the one it calls current.
  const ofYear = withSchoolYear(year.id);

  yield* read(paths.appData, client.app.getData, encodeAppData);
  yield* read(paths.timeGrid, client.timetable.getTimeGrid, encodeTimeGrid);

  const [classes] = yield* Effect.forEach(directories, (resourceType) =>
    read(
      paths.filter(year.id, resourceType),
      ofYear(client.timetable.getFilter({ resourceType, start, end })),
      encodeFilter,
    ),
  );

  yield* read(
    paths.exams(year.id),
    ofYear(client.exams.list({ start: first, end: last })),
    encodeExams,
  );

  const yearStart = decodeDate(start);

  if (classes === undefined || Option.isNone(classes) || Option.isNone(yearStart)) return done;

  const views = Plan.classes({
    profile,
    previous,
    directory: classes.value.classes.map((each) => each.class),
    schoolYear: ImportIds.schoolYear(yearStart.value),
  });

  // Each view takes a request at least, so a plan larger than what is left can't complete.
  if (views.length > (yield* input.left)) {
    failures.push({ read: "plan", tag: new PlanTooLarge()._tag });

    return done;
  }

  yield* Effect.forEach(views, (resource) => viewRead(read, client, yearRead, "CLASS", resource), {
    concurrency: 2,
    discard: true,
  });

  return done;
});

/**
 * Reads the students' directory and the own views of the students the profile's grade levels
 * hold, for the self-check. They are stored like the snapshot's reads, but the night's rows never
 * depend on them: a failure leaves the self-check unmeasured, and so does a directory with more
 * students than `left` requests.
 */
const readStudents = Effect.fn("ImportRun.readStudents")(function* (input: {
  readonly client: WebUntisClient["Service"];
  readonly left: Effect.Effect<number>;
  readonly profile: SchoolProfile.SchoolProfile;
  readonly year: YearRead;
}) {
  const { client, year } = input;
  const { reads, failures, read } = reader();

  const directory = yield* read(
    RecordedWebUntis.paths.filter(year.id, "STUDENT"),
    withSchoolYear(year.id)(
      client.timetable.getFilter({ resourceType: "STUDENT", start: year.start, end: year.end }),
    ),
    encodeFilter,
  );

  if (Option.isNone(directory)) return { reads, failures };

  const students = Plan.students(input.profile, directory.value.students);

  if (students.length > (yield* input.left)) {
    failures.push({ read: "plan", tag: new PlanTooLarge()._tag });

    return { reads, failures };
  }

  yield* Effect.forEach(students, (resource) => viewRead(read, client, year, "STUDENT", resource), {
    concurrency: 2,
    discard: true,
  });

  return { reads, failures };
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

/** The state without the lessons `drop` names, and without their links. */
const without = (
  state: SchoolImport.ImportResult,
  drop: (lesson: SchoolImport.ImportedLesson) => boolean,
): SchoolImport.ImportResult => {
  const gone = new Set(state.lessons.flatMap((lesson) => (drop(lesson) ? [lesson.id] : [])));

  return {
    ...state,
    lessons: state.lessons.filter(({ id }) => !gone.has(id)),
    links: state.links.filter(({ id }) => !gone.has(id)),
  };
};

/**
 * What the next run builds on: nothing before today, which never changes, a lesson's text only as
 * a stock phrase, as it is published, and no diagnostics.
 */
const checkpointOf = (
  profile: SchoolProfile.SchoolProfile,
  state: SchoolImport.ImportResult,
  today: string,
): SchoolImport.ImportResult => {
  const kept = without(state, ({ date }) => date < today);
  const past = new Set(kept.exams.flatMap(({ id, date }) => (date < today ? [id] : [])));

  return {
    ...kept,
    lessons: kept.lessons.map((lesson) => Projection.withStockPhrase(profile, lesson)),
    exams: kept.exams.filter(({ id }) => !past.has(id)),
    links: kept.links.filter(({ id }) => !past.has(id)),
    diagnostics: [],
  };
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

/** What the store needs of a set of reads, and what it says about them on the run's report. */
const store = Effect.fn("ImportRun.store")(function* (
  school: School.Id,
  now: DateTime.Utc,
  answered: {
    readonly reads: ReadonlyArray<SourceStore.Read>;
    readonly failures: ReadonlyArray<Failure>;
  },
  report: Ref.Ref<Report>,
) {
  const versions: Array<SourceStore.Version> = [];
  const drift = new Set<string>();
  const failures = [...answered.failures];

  for (const read of answered.reads) {
    const sanitized = SourceStore.sanitize(read);

    if (Result.isFailure(sanitized)) {
      failures.push({ read: Policy.readKind(read.path), tag: sanitized.failure._tag });
    } else {
      versions.push(...sanitized.success.versions);

      for (const path of sanitized.success.drift)
        drift.add(`${Policy.readKind(read.path)} ${path}`);
    }
  }

  const versionsStored = yield* SourceStore.write(school, now, versions);

  yield* Ref.update(report, (current) => {
    const reads = { ...current.reads };
    const tags = { ...current.failures };

    for (const { path } of answered.reads) {
      const kind = Policy.readKind(path);

      reads[kind] = { ok: (reads[kind]?.ok ?? 0) + 1, failed: reads[kind]?.failed ?? 0 };
    }

    for (const { read, tag } of failures) {
      reads[read] = { ok: reads[read]?.ok ?? 0, failed: (reads[read]?.failed ?? 0) + 1 };
      tags[tag] = (tags[tag] ?? 0) + 1;
    }

    return {
      ...current,
      reads,
      failures: tags,
      drift: [...new Set([...current.drift, ...drift])].sort(),
      versionsStored: current.versionsStored + versionsStored,
    };
  });

  return { versions, failures };
});

const decodePlainDate = Schema.decodeEffect(CivilTime.PlainDate);
const decodeKept = Schema.decodeUnknownEffect(Schema.toCodecJson(Schema.Array(SelfCheck.Kept)));
const encodeKept = Schema.encodeEffect(Schema.fromJsonString(Schema.Array(SelfCheck.Kept)));
const encodeSelfCheck = Schema.encodeEffect(Schema.fromJsonString(SelfCheck.Result));

/**
 * The nightly self-check, after the night's publish: the students' views, stored like the
 * snapshot's, against the lessons the projection publishes, recorded on the run's row with the
 * Kurswahlen kept for the next night. Whatever fails leaves it unmeasured and the run's outcome as
 * it was.
 */
const checkSelf = Effect.fn("ImportRun.checkSelf")(function* (input: {
  readonly options: Options;
  readonly lease: Lease.Claim;
  readonly run: string;
  readonly requests: Effect.Success<ReturnType<typeof dispatch>>;
  readonly report: Ref.Ref<Report>;
  readonly client: WebUntisClient["Service"];
  readonly year: YearRead;
  readonly now: DateTime.Utc;
  readonly today: CivilTime.PlainDate;
  /** The snapshot's stored versions, which hold the directories the views need. */
  readonly snapshot: ReadonlyArray<SourceStore.Version>;
  readonly projection: Projection.Projection;
}) {
  const sql = yield* SqlClient.SqlClient;
  const { options, requests, year, now, projection } = input;
  const { profile } = options;
  const left = Effect.map(requests.sent, (sent) => options.maximum - sent);

  const read = yield* readStudents({ client: input.client, left, profile, year });
  const { versions, failures } = yield* store(profile.id, now, read, input.report);
  const account = yield* requests.account;

  const unmeasured = (reason: string) =>
    Effect.succeed({
      result: SelfCheck.Result.cases.NotMeasured.make({ reason }),
      kept: Option.none<ReadonlyArray<SelfCheck.Kept>>(),
    });

  const reason = Option.isSome(account)
    ? Option.some(account.value)
    : Arr.head(failures).pipe(Option.map(({ tag }) => tag));

  const checked = Option.isSome(reason)
    ? yield* unmeasured(reason.value)
    : yield* Effect.gen(function* () {
        const kept = yield* decodeKept(input.lease.kurswahl);

        const { client } = yield* RecordedWebUntis.make(
          SourceStore.recordingOf(
            [...input.snapshot, ...versions].map((version) => ({ ...version, observedAt: now })),
          ),
          { asOf: now },
        );

        const { views } = yield* Truth.readViews(
          client,
          [{ start: year.first, end: year.last }],
          ["STUDENT"],
          (student) => SchoolProfile.readsStudent(profile, student),
        );

        const published = new Set(
          Object.values(projection.data.lessons).flatMap((rows) => Object.keys(rows)),
        );

        const last = yield* decodePlainDate(year.last);

        const scored = SelfCheck.score({
          students: [...views.values()],
          lessons: Metrics.lessonsOf({
            lessons: projection.state.lessons.filter(({ id }) => published.has(id)),
            links: projection.state.links,
          }),
          terms: projection.state.terms,
          days: { start: input.today, end: last },
          kept,
        });

        return {
          result: SelfCheck.Result.cases.Measured.make(scored.measured),
          kept: Option.some(scored.kept),
        };
      }).pipe(
        Effect.catchCause((cause) =>
          unmeasured(
            Option.match(Cause.findErrorOption(cause), {
              onNone: () => "Defect",
              onSome: tagOf,
            }),
          ),
        ),
      );

  const selfCheck = yield* encodeSelfCheck(checked.result);
  const reportJson = yield* encodeReport(yield* Ref.get(input.report));
  const sent = yield* requests.sent;

  yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`
        update import_run
        set self_check = ${selfCheck}::jsonb, sent = ${sent}, report = ${reportJson}::jsonb
        where id = ${input.run}::uuid
      `;

      if (Option.isSome(checked.kept)) {
        yield* sql`
          update import_school set kurswahl = ${yield* encodeKept(checked.kept.value)}::jsonb
          where school_id = ${profile.id} and lease_owner = ${input.lease.owner}::uuid
        `;
      }
    }),
  );

  if (checked.result._tag === "Measured") {
    for (const measure of SelfCheck.measures(checked.result, profile.thresholds)) {
      if (!measure.clears) {
        yield* Effect.logWarning("The self-check is below its threshold").pipe(
          Effect.annotateLogs({
            measure: measure.label,
            value: measure.value,
            threshold: measure.threshold,
          }),
        );
      }
    }
  } else {
    yield* Effect.logWarning("The self-check measured nothing").pipe(
      Effect.annotateLogs({ reason: checked.result.reason }),
    );
  }
});

/**
 * A night's self-check that the deadline or a defect cut off after the publish says so, and the
 * row counts the requests it sent. One that finished keeps its result.
 */
const unfinished = Effect.fn("ImportRun.unfinished")(function* (
  run: string,
  reason: string,
  sent: number,
) {
  const sql = yield* SqlClient.SqlClient;
  const selfCheck = yield* encodeSelfCheck(SelfCheck.Result.cases.NotMeasured.make({ reason }));

  yield* sql`
    update import_run
    set self_check = coalesce(self_check, ${selfCheck}::jsonb), sent = greatest(sent, ${sent})
    where id = ${run}::uuid
  `;
}, Effect.orDie);

/** The run after it holds the lease and its requests. */
const leased = Effect.fn("ImportRun.leased")(function* (
  options: Options,
  lease: Lease.Claim,
  run: string,
  requests: Effect.Success<ReturnType<typeof dispatch>>,
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

  const known = without(
    Option.getOrElse(previous, () => SchoolImport.empty),
    ({ date }) => date < today,
  );

  // A lease that passed meanwhile, also during the wait for the reservation, opens no connection.
  if (!DateTime.isLessThan(yield* DateTime.now, lease.until)) return "TimedOut" as const;

  const left = Effect.map(requests.sent, (sent) => options.maximum - sent);

  // One connection for the whole run: the self-check reads after the publish, without a second login.
  const connected = yield* Effect.result(Layer.build(options.source(requests.gate)));

  const client = Result.match(connected, {
    onSuccess: (context) => Option.some(Context.get(context, WebUntisClient)),
    onFailure: () => Option.none<WebUntisClient["Service"]>(),
  });

  const snapshot = Result.isSuccess(connected)
    ? yield* readSnapshot({
        client: Context.get(connected.success, WebUntisClient),
        left,
        profile,
        previous: known,
        window,
      })
    : {
        reads: [],
        failures: [{ read: "connect", tag: tagOf(connected.failure) }],
        year: Option.none<YearRead>(),
      };

  if (snapshot.failures.some(({ tag }) => tag === "InvalidCredentials")) yield* requests.refuse;

  // Reads that answered are stored even when another failed: the store is a log.
  const { versions, failures } = yield* store(school, now, snapshot, report);
  const versionsPruned = yield* SourceStore.prune(school, profile.school.timeZone, now);

  yield* Ref.update(report, (current) => ({ ...current, versionsPruned }));

  // A lost session ends the run whatever a view already in flight returned.
  const account = yield* requests.account;

  if (Option.isSome(account)) return account.value;

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

  // A school's first publish shows its own snapshot: lessons only dark runs saw never were rows,
  // and nothing published says they are there. A first publish writes a Stand, so later ones see it.
  const first = profile.publish && Option.isNone(yield* Schools.importStatus(school));

  const projection = Projection.project({
    profile,
    previous: first ? without(known, () => true) : known,
    result,
    pending,
    today: window.start,
  });

  const next = checkpointOf(profile, projection.state, today);
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

  const settled = yield* sql.withTransaction(
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

  if (options.nightly && Option.isSome(client) && Option.isSome(snapshot.year)) {
    yield* checkSelf({
      options,
      lease,
      run,
      requests,
      report,
      client: client.value,
      year: snapshot.year.value,
      now,
      today: window.start,
      snapshot: versions,
      projection,
    });
  }

  return settled;
}, Effect.scoped);

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

    // A wait here can outlast the lease, and then the run reads nothing.
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

    // The reservation counts against the school's date, so its requests end with that date.
    const requests = yield* dispatch(
      options.maximum,
      sendsUntil(options.profile.school, startedAt, lease.until),
    );

    const report = yield* Ref.make(emptyReport);

    const exit = yield* Effect.exit(
      leased(options, lease, reservation.id, requests, report).pipe(
        Effect.timeoutOrElse({
          duration: Duration.max(
            DateTime.distance(yield* DateTime.now, lease.until),
            Duration.zero,
          ),
          orElse: () => Effect.succeed("TimedOut" as const),
        }),
      ),
    );

    const error = Exit.isFailure(exit) ? Cause.findErrorOption(exit.cause) : Option.none();
    const superseded = Option.exists(error, Schema.is(Superseded));

    // A refused password or a lost session stands even when the deadline or a failure came later.
    const outcome: Outcome = Option.getOrElse(yield* requests.account, () =>
      Exit.isSuccess(exit) ? exit.value : superseded ? "Superseded" : "Failed",
    );

    const final = yield* Ref.get(report);

    const recorded =
      Exit.isFailure(exit) && !superseded
        ? { ...final, failure: Option.match(error, { onNone: () => "Defect", onSome: tagOf }) }
        : final;

    // A run that published wrote its row in the same transaction, and that outcome stands.
    const settled = yield* finish(reservation.id, outcome, yield* requests.sent, recorded);

    if (options.nightly && (settled === "Dark" || settled === "Published")) {
      yield* unfinished(
        reservation.id,
        outcome === settled ? "Unfinished" : outcome,
        yield* requests.sent,
      );
    }

    return { outcome: settled, run: Option.some(reservation.id), report: recorded } satisfies Ran;
  }).pipe(Effect.ensuring(Lease.release(school, lease.owner)));
});
