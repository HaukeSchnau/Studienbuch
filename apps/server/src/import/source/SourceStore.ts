/**
 * The source store (m2-import-path.md, section 3): every read a run made, through the storage
 * policy, as one version per day of a timetable and one per read without a range, written only
 * when it changed and kept 35 days. It is a log for exports and for the history of a change,
 * never an import's input: each run imports its own snapshot.
 */
import { CivilTime, type School } from "@stu/core";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { Policy } from "../corpus/Policy.ts";

export * as SourceStore from "./SourceStore.ts";

/** One read as WebUntis answered it. */
export interface Read {
  /** The corpus's path, as `RecordedWebUntis.paths` writes it. */
  readonly path: string;
  /** The days a timetable read asked for. A read without a range is kept whole. */
  readonly range?: { readonly start: string; readonly end: string };
  readonly body: Schema.Json;
}

/** What the store keeps of one read on one day, or of a read without a range. */
export interface Version {
  readonly path: string;
  readonly day?: string;
  readonly body: Schema.Json;
}

/** A read the policy can't store: one it doesn't know, or a field of the wrong kind. */
export class Unstorable extends Schema.TaggedError<Unstorable, { readonly brand: unique symbol }>()(
  "SourceStore.Unstorable",
  {
    read: Schema.String,
    problems: Schema.Array(Schema.Struct({ path: Schema.String, problem: Schema.String })),
  },
) {}

/**
 * Days a version stays after it was observed (D113). A run first reads a day when it enters the
 * window, `Plan.windowDays` ahead, so a day from today on keeps every version it has.
 */
export const keptDays = 35;

const decodeDay = Schema.decodeOption(CivilTime.PlainDate);

/** Every date from `start` to `end`, as WebUntis writes them. */
const daysOf = (start: string, end: string) => {
  const first = decodeDay(start);
  const last = decodeDay(end);
  const days: Array<string> = [];

  if (Option.isNone(first) || Option.isNone(last)) return days;

  for (let day = first.value; CivilTime.order(day, last.value) <= 0;) {
    days.push(CivilTime.format(day));
    day = CivilTime.addDays(day, 1);
  }

  return days;
};

const isDay = Schema.is(Schema.Struct({ date: Schema.String }));

/** A timetable's answer as one answer per day of its range, each with the read's errors. */
const byDay = (path: string, range: NonNullable<Read["range"]>, body: Policy.JsonObject) => {
  const days = Array.isArray(body.days) ? body.days : [];

  return daysOf(range.start, range.end).map((day): Version => ({
    path,
    day,
    body: {
      ...body,
      days: days.filter((each) => isDay(each) && each.date.startsWith(day)),
    },
  }));
};

/**
 * A read as the store keeps it, split by day, and the paths of the fields it dropped because no
 * rule names them. WebUntis leaves out days without school, so such a day is a version without
 * days, and a replay answers it as WebUntis did.
 */
export const sanitize = (
  read: Read,
): Result.Result<
  { readonly versions: ReadonlyArray<Version>; readonly drift: ReadonlyArray<string> },
  Unstorable
> => {
  const rules = Policy.forRead(read.path);

  if (rules === undefined) {
    return Result.fail(
      new Unstorable({
        read: Policy.readKind(read.path),
        problems: [{ path: "", problem: "a read without rules" }],
      }),
    );
  }

  // The store keeps no text of a student's own view, which it knows by its days' kind.
  const days = Policy.isObject(read.body) && Array.isArray(read.body.days) ? read.body.days : [];

  if (
    rules.view?.type === "STUDENT" &&
    days.some((day) => !Policy.isObject(day) || day.resourceType !== "STUDENT")
  ) {
    return Result.fail(
      new Unstorable({
        read: Policy.readKind(read.path),
        problems: [{ path: "days[].resourceType", problem: "a day of another kind of view" }],
      }),
    );
  }

  const { value, problems } = Policy.walk(rules.node, read.body, Policy.store);
  const wrong = problems.filter(({ problem }) => problem !== Policy.withoutRule);

  if (wrong.length > 0 || !rules.decodes(value)) {
    return Result.fail(
      new Unstorable({
        read: Policy.readKind(read.path),
        problems:
          wrong.length > 0
            ? wrong.map(({ path, problem }) => ({ path, problem }))
            : [{ path: "", problem: "doesn't decode once stored" }],
      }),
    );
  }

  const drift = problems.flatMap(({ path, problem }) =>
    problem === Policy.withoutRule ? [path] : [],
  );

  const versions =
    read.range === undefined || !Policy.isObject(value)
      ? [{ path: read.path, body: value }]
      : byDay(read.path, read.range, value);

  return Result.succeed({ versions, drift });
};

/** Versions as a recording that answers like the snapshot they came from. */
export const recordingOf = (
  versions: ReadonlyArray<Version & { readonly observedAt: DateTime.Utc }>,
): RecordedWebUntis.Recording => {
  const reads = new Map<string, Array<RecordedWebUntis.Version>>();

  for (const { path, day, observedAt, body } of versions) {
    const version: RecordedWebUntis.Version =
      day === undefined ? { observedAt, body } : { observedAt, start: day, end: day, body };

    reads.set(path, [...(reads.get(path) ?? []), version]);
  }

  return new Map([...reads].map(([path, each]) => [path, { versions: each }]));
};

const encodeRows = Schema.encodeEffect(
  Schema.fromJsonString(
    Schema.Array(
      Schema.Struct({ path: Schema.String, day: Schema.NullOr(Schema.String), body: Schema.Json }),
    ),
  ),
);

/**
 * Writes each version whose body differs from the latest of its path and day, and returns how many
 * it wrote. PostgreSQL prints a jsonb with its keys sorted, so equal bodies hash alike whatever
 * order WebUntis sent their fields in.
 */
export const write = Effect.fn("SourceStore.write")(function* (
  school: School.Id,
  observedAt: DateTime.Utc,
  versions: ReadonlyArray<Version>,
) {
  if (versions.length === 0) return 0;

  const sql = yield* SqlClient.SqlClient;

  const rows = yield* encodeRows(
    versions.map(({ path, day, body }) => ({ path, day: day ?? null, body })),
  );

  const [row] = yield* sql<{ readonly written: number }>`
    with incoming as (
      select x.path, x.day, x.body,
        encode(sha256(convert_to(x.body::text, 'UTF8')), 'hex') as hash
      from jsonb_to_recordset(${rows}::jsonb) as x(path text, day date, body jsonb)
    ), inserted as (
      insert into source_version (school_id, path, day, observed_at, hash, body)
      select ${school}, i.path, i.day, ${DateTime.toDateUtc(observedAt)}, i.hash, i.body
      from incoming i
      where i.hash is distinct from (
        select v.hash from source_version v
        where v.school_id = ${school} and v.path = i.path
          and (v.day = i.day or (v.day is null and i.day is null))
        order by v.observed_at desc limit 1
      )
      returning 1
    )
    select count(*)::int as written from inserted
  `;

  return row?.written ?? 0;
}, Effect.orDie);

/**
 * Deletes versions observed more than `keptDays` before `now`, except the newest of each read
 * without a range. A directory is written only when it changes, so its newest version can be
 * older and still be what WebUntis answers.
 */
export const prune = Effect.fn("SourceStore.prune")(function* (
  school: School.Id,
  now: DateTime.Utc,
) {
  const sql = yield* SqlClient.SqlClient;
  const before = DateTime.subtract(now, { days: keptDays });

  const [row] = yield* sql<{ readonly deleted: number }>`
    with deleted as (
      delete from source_version v
      where v.school_id = ${school} and v.observed_at < ${DateTime.toDateUtc(before)}
        and not (
          v.day is null
          and v.observed_at = (
            select max(w.observed_at) from source_version w
            where w.school_id = v.school_id and w.path = v.path and w.day is null
          )
        )
      returning 1
    )
    select count(*)::int as deleted from deleted
  `;

  return row?.deleted ?? 0;
}, Effect.orDie);

/** Every version the store holds for the school, as a recording an import can replay. */
export const recording = Effect.fn("SourceStore.recording")(function* (school: School.Id) {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql<{
    readonly path: string;
    readonly day: string | null;
    readonly observedAt: Date;
    readonly body: Schema.Json;
  }>`
    select path, day::text as day, observed_at as "observedAt", body from source_version
    where school_id = ${school} order by path, observed_at, day
  `;

  return recordingOf(
    rows.map(({ path, day, observedAt, body }) => {
      const at = DateTime.fromDateUnsafe(observedAt);

      return day === null ? { path, observedAt: at, body } : { path, day, observedAt: at, body };
    }),
  );
}, Effect.orDie);
