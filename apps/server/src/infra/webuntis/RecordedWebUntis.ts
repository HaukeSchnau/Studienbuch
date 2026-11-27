/**
 * A `WebUntisClient` that answers from a recording instead of WebUntis (m2-import-corpus.md,
 * section 6). It answers by meaning, not by recorded request: entries for any range come from the
 * recorded reads that cover each of its days, so an import may chunk its windows as it likes.
 */
import {
  DecodeError,
  InvalidRequestError,
  TransportError,
  type ExamsListRequest,
  type TimetableEntriesRequest,
  type WebUntisClient,
} from "@schnau/webuntis-api";
import {
  AppDataSchema,
  ExamsSchema,
  SchoolyearSchema,
  TimeGridSchema,
  TimetableEntriesSchema,
  TimetableFilterSchema,
  type TimetableEntries,
  type TimetableEntryDay,
  type TimetableResourceType,
} from "@schnau/webuntis-api/schemas";
import { CivilTime, School } from "@stu/core";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Hash from "effect/Hash";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

export * as RecordedWebUntis from "./RecordedWebUntis.ts";

const Day = Schema.toEncoded(CivilTime.PlainDate);

/** One answer WebUntis gave at `observedAt`, for the days `start` to `end` of a read that takes a range. */
export const Version = Schema.Struct({
  observedAt: Schema.DateTimeUtcFromString,
  start: Schema.optional(Day),
  end: Schema.optional(Day),
  /** The JSON exactly as WebUntis sent it. */
  body: Schema.Json,
});

export type Version = typeof Version.Type;

export const Read = Schema.Struct({ versions: Schema.Array(Version) });

export type Read = typeof Read.Type;

/** Recorded reads by their path under the corpus's `reads/`, without `.json`. */
export type Recording = ReadonlyMap<string, Read>;

export const paths = {
  schoolYears: "schoolyears",
  appData: "app-data",
  timeGrid: "timegrid",
  filter: (year: number, type: TimetableResourceType) => `${year}/filter-${type}`,
  entries: (year: number, type: TimetableResourceType, resource: number) =>
    `${year}/entries/${type}/${resource}`,
  exams: (year: number) => `${year}/exams`,
};

/**
 * The recording holds no answer for a read. webuntis-api's errors are a closed union, so it reaches
 * the import as the cause of a `TransportError`, and the run's `Log` lists it.
 */
export class NotCaptured extends Schema.TaggedError<
  NotCaptured,
  { readonly brand: unique symbol }
>()("RecordedWebUntis.NotCaptured", { read: Schema.String }) {}

export interface Options {
  /**
   * Each read answers with the latest version observed by then. Before the first observation it
   * answers with the earliest, so a capture taken after the fact replays at any earlier time.
   */
  readonly asOf: DateTime.Utc;
  /** The days the capture read. A day outside them is `outOfRange`, a day inside them a gap. */
  readonly captured?: ReadonlyArray<{ readonly start: string; readonly end: string }>;
  /** Answers every list in reverse order, which must change nothing an import concludes. */
  readonly reversed?: boolean;
  /**
   * Fails about one read in `oneIn`, picked by a hash of `seed` and the read, whatever their
   * order. School years and directories never fail: without them a run can't start, which is safe
   * and proves nothing.
   */
  readonly failures?: { readonly seed: string; readonly oneIn: number };
}

/** What one run's reads did, by read. */
export interface Log {
  readonly requests: number;
  /** Reads of days outside the captured ranges, which an import's lookahead makes normal. */
  readonly outOfRange: ReadonlyArray<string>;
  /** Reads the recording lacks although it should hold them: a gap in the corpus. */
  readonly notCaptured: ReadonlyArray<string>;
  readonly decodeFailures: ReadonlyArray<string>;
  readonly injected: ReadonlyArray<string>;
}

const decodeYears = Schema.decodeUnknownEffect(Schema.Array(SchoolyearSchema));
const decodeAppData = Schema.decodeUnknownEffect(AppDataSchema);
const decodeTimeGrid = Schema.decodeUnknownEffect(TimeGridSchema);
const decodeFilter = Schema.decodeUnknownEffect(TimetableFilterSchema);
const decodeExams = Schema.decodeUnknownEffect(ExamsSchema);
const decodeEntries = Schema.decodeUnknownExit(TimetableEntriesSchema);

const decodeRawDays = Schema.decodeUnknownOption(
  Schema.Struct({ days: Schema.Array(Schema.Unknown) }),
);

const decodeDate = Schema.decodeEffect(CivilTime.PlainDate);
const encodeDate = Schema.encodeEffect(CivilTime.PlainDate);

const reverseDeep = (value: Schema.Json): Schema.Json => {
  if (Array.isArray(value)) return value.map(reverseDeep).reverse();

  // JSON's objects are the only instances left once arrays are out; strings and numbers aren't.
  if (!(value instanceof Object)) return value;

  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, reverseDeep(inner)]));
};

const later = (a: Version, b: Version) => DateTime.isLessThan(b.observedAt, a.observedAt);

/** The version that answers for `day`, or for the whole read when it takes no range. */
export const pick = (read: Read, asOf: DateTime.Utc, day?: string): Option.Option<Version> => {
  const covering = read.versions.filter(
    (version) =>
      day === undefined ||
      version.start === undefined ||
      version.end === undefined ||
      (version.start <= day && day <= version.end),
  );

  const seen = covering.filter((version) => DateTime.isLessThanOrEqualTo(version.observedAt, asOf));

  if (seen.length > 0) {
    return Option.some(seen.reduce((best, version) => (later(best, version) ? best : version)));
  }

  return covering.length === 0
    ? Option.none()
    : Option.some(covering.reduce((best, version) => (later(version, best) ? best : version)));
};

/** Every date from `start` to `end`. WebUntis's client refuses a request with a malformed date. */
const datesBetween = Effect.fn("RecordedWebUntis.datesBetween")(
  function* (start: string, end: string) {
    const last = yield* decodeDate(end);
    const dates: Array<string> = [];

    for (let date = yield* decodeDate(start); CivilTime.order(date, last) <= 0;) {
      dates.push(yield* encodeDate(date));
      date = CivilTime.addDays(date, 1);
    }

    return dates;
  },
  Effect.mapError(
    () => new InvalidRequestError({ path: "start", message: "start and end must be dates" }),
  ),
);

export const make = Effect.fn("RecordedWebUntis.make")(function* (
  recording: Recording,
  options: Options,
) {
  const log = yield* Ref.make<Log>({
    requests: 0,
    outOfRange: [],
    notCaptured: [],
    decodeFailures: [],
    injected: [],
  });

  const note = (
    field: "outOfRange" | "notCaptured" | "decodeFailures" | "injected",
    read: string,
  ) => Ref.update(log, (current) => ({ ...current, [field]: [...current[field], read] }));

  const bodyOf = (version: Version) =>
    options.reversed === true ? reverseDeep(version.body) : version.body;

  const inRange = (day: string) =>
    options.captured === undefined ||
    options.captured.some((range) => range.start <= day && day <= range.end);

  /** Logs each missing read, as a gap when its day lies inside the captured ranges, and fails. */
  const notCaptured = (
    read: string,
    day?: string,
    more: ReadonlyArray<readonly [string, string]> = [],
  ) =>
    Effect.forEach(
      [[read, day] as const, ...more],
      ([each, eachDay]) =>
        note(eachDay === undefined || inRange(eachDay) ? "notCaptured" : "outOfRange", each),
      { discard: true },
    ).pipe(
      Effect.andThen(
        Effect.fail(
          new TransportError({
            method: "GET",
            path: read,
            message: "not captured",
            cause: new NotCaptured({ read }),
          }),
        ),
      ),
    );

  const decodeFailed = (read: string) =>
    note("decodeFailures", read).pipe(
      Effect.andThen(
        Effect.fail(new DecodeError({ path: read, message: "the recorded body doesn't decode" })),
      ),
    );

  const request = Ref.update(log, (current) => ({ ...current, requests: current.requests + 1 }));

  /**
   * Fails a read the recording could answer when the run injects a failure for `key`. A read that
   * fails anyway isn't counted as injected.
   */
  const inject = Effect.fn("RecordedWebUntis.inject")(function* (key: string, fallible = true) {
    const failures = options.failures;

    if (
      fallible &&
      failures !== undefined &&
      Math.abs(Hash.string(`${failures.seed} ${key}`)) % failures.oneIn === 0
    ) {
      yield* note("injected", key);

      return yield* new TransportError({ method: "GET", path: key, message: "injected failure" });
    }
  });

  const latest = (path: string): Effect.Effect<Schema.Json, TransportError> => {
    const version = Option.fromNullishOr(recording.get(path)).pipe(
      Option.flatMap((read) => pick(read, options.asOf)),
    );

    return Option.isSome(version) ? Effect.succeed(bodyOf(version.value)) : notCaptured(path);
  };

  const answer = <A, E>(
    path: string,
    decode: (body: Schema.Json) => Effect.Effect<A, E>,
    fallible = true,
  ): Effect.Effect<A, TransportError | DecodeError> =>
    request.pipe(
      Effect.andThen(latest(path)),
      Effect.flatMap((body) => decode(body).pipe(Effect.catch(() => decodeFailed(path)))),
      Effect.tap(() => inject(path, fallible)),
    );

  const years = answer(paths.schoolYears, decodeYears, false);

  // The lookup isn't a request: an import that reads entries has read the years already.
  const recordedYears = latest(paths.schoolYears).pipe(
    Effect.flatMap((body) =>
      decodeYears(body).pipe(Effect.catch(() => decodeFailed(paths.schoolYears))),
    ),
  );

  const yearIn = (all: Effect.Success<typeof recordedYears>, day: string) =>
    all.find(
      ({ dateRange }) => dateRange.start.slice(0, 10) <= day && day <= dateRange.end.slice(0, 10),
    )?.id;

  const yearOf = (day: string): Effect.Effect<number, TransportError | DecodeError> =>
    recordedYears.pipe(
      Effect.flatMap((all) => {
        const year = yearIn(all, day);

        return year === undefined
          ? notCaptured(`school year of ${day}`, day)
          : Effect.succeed(year);
      }),
    );

  const decodedVersions = new Map<Version, Exit.Exit<TimetableEntries, unknown>>();

  /** The live client refuses a range that ends before it starts, before it sends anything. */
  const backwards = (range: { readonly start: string; readonly end: string }) =>
    range.start > range.end
      ? Effect.fail(new InvalidRequestError({ path: "end", message: "must not be before start" }))
      : Effect.void;

  /** One resource's entries, assembled day by day from the versions that cover each day. */
  const entries = Effect.fn("RecordedWebUntis.entries")(function* (input: TimetableEntriesRequest) {
    const key = `entries ${input.resourceType} ${input.resource} ${input.start}..${input.end}`;

    yield* backwards(input);
    yield* request;

    // The capture asks with webuntis-api's defaults, so it can't answer another query.
    if (
      (input.timetableType ?? "STANDARD") !== "STANDARD" ||
      (input.format ?? 2) !== 2 ||
      (input.layout ?? "START_TIME") !== "START_TIME" ||
      (input.periodTypes ?? "") !== ""
    ) {
      return yield* notCaptured(`${key} with another query`);
    }

    const days: Array<TimetableEntryDay> = [];
    const used = new Set<TimetableEntries>();
    const raw: Array<unknown> = [];
    let format = 2;

    const years = yield* recordedYears;

    // Every day is looked up before a miss fails the read, so a day outside the capture can't
    // hide a gap or an undecodable body on another.
    const missing: Array<readonly [string, string]> = [];
    const undecodable: Array<string> = [];

    const dates = yield* datesBetween(input.start, input.end);

    for (const day of dates) {
      const year = yearIn(years, day);

      const path =
        year === undefined
          ? `school year of ${day}`
          : paths.entries(year, input.resourceType, input.resource);

      const version = Option.fromNullishOr(recording.get(path)).pipe(
        Option.flatMap((read) => pick(read, options.asOf, day)),
      );

      if (Option.isNone(version)) {
        missing.push([year === undefined ? path : `${path} ${day}`, day]);

        continue;
      }

      const body = bodyOf(version.value);
      const decoded = decodedVersions.get(version.value) ?? decodeEntries(body);

      decodedVersions.set(version.value, decoded);

      if (Exit.isFailure(decoded)) {
        undecodable.push(`${path} ${day}`);

        continue;
      }

      format = decoded.value.format;
      used.add(decoded.value);

      const index = decoded.value.days.findIndex((each) => each.date.slice(0, 10) === day);
      const found = decoded.value.days[index];

      if (found !== undefined) {
        days.push(found);
        raw.push(Option.getOrUndefined(decodeRawDays(body))?.days[index]);
      }
    }

    // A gap in the capture fails the read first, day by day, then a body that doesn't decode. Days
    // past the capture come last and count once, because lookahead makes them normal. A read that
    // also reaches captured days answers with those, as WebUntis does when it leaves days out, so
    // the import keeps their lessons and can't count the read complete.
    const [firstGap, ...moreGaps] = missing.filter(([, day]) => inRange(day));

    if (firstGap !== undefined) return yield* notCaptured(firstGap[0], firstGap[1], moreGaps);

    const [firstUndecodable] = undecodable;

    if (firstUndecodable !== undefined) return yield* decodeFailed(firstUndecodable);

    const [firstMissing] = missing;

    if (firstMissing !== undefined && missing.length === dates.length) {
      return yield* notCaptured(firstMissing[0], firstMissing[1]);
    }

    if (firstMissing !== undefined) yield* note("outOfRange", firstMissing[0]);

    yield* inject(key);

    if (options.reversed === true) {
      days.reverse();
      raw.reverse();
    }

    // WebUntis's errors explain an answer, so they travel with every day taken from it.
    const errors = [...used].flatMap((each) => each.errors);
    const decoded: TimetableEntries = { format, days, errors };

    return { decoded, raw: { format, days: raw, errors } };
  });

  const missing = (method: string) => request.pipe(Effect.andThen(notCaptured(method)));

  const today = DateTime.formatIsoDate(
    DateTime.setZoneNamedUnsafe(options.asOf, School.defaultTimeZone),
  );

  /** The school year's recorded exams, cut to the range as WebUntis would. */
  const examList = Effect.fn("RecordedWebUntis.examList")(function* (input?: ExamsListRequest) {
    const start = input?.start ?? today;
    const all = yield* answer(paths.exams(yield* yearOf(start.slice(0, 10))), decodeExams);

    const exams = all.exams.filter(
      (exam) =>
        (input?.withDeleted === true || !exam.deleted) &&
        (input?.start === undefined ||
          input.end === undefined ||
          (input.start <= exam.examStart.slice(0, 10) && exam.examStart.slice(0, 10) <= input.end)),
    );

    return { exams, withDeleted: input?.withDeleted === true };
  });

  const client: WebUntisClient["Service"] = {
    auth: { ensureAuthenticated: Effect.void, refresh: Effect.void, clear: Effect.void },
    app: {
      getData: answer(paths.appData, decodeAppData),
      getHome: missing("app.getHome"),
      getMobileData: missing("app.getMobileData"),
      getStartupActions: missing("app.getStartupActions"),
      getPlatformApplicationMenus: missing("app.getPlatformApplicationMenus"),
      getThirdPartyData: missing("app.getThirdPartyData"),
      getExamIntegrations: missing("app.getExamIntegrations"),
      getTodayMeta: missing("app.getTodayMeta"),
      getDashboardCards: missing("app.getDashboardCards"),
      getDashboardCardsDetail: missing("app.getDashboardCardsDetail"),
      getDashboardCardsStatus: missing("app.getDashboardCardsStatus"),
      getOnboarding: () => missing("app.getOnboarding"),
    },
    classreg: {
      getAbsencesMeta: missing("classreg.getAbsencesMeta"),
      getHomeworkMeta: missing("classreg.getHomeworkMeta"),
      getHomeworkList: () => missing("classreg.getHomeworkList"),
      getLessonTopicsMeta: missing("classreg.getLessonTopicsMeta"),
    },
    exams: {
      list: examList,
      getFilter: () => missing("exams.getFilter"),
      getStatistics: () => missing("exams.getStatistics"),
      getExam: () => missing("exams.getExam"),
      getForClass: missing("exams.getForClass"),
    },
    schoolyears: { list: years },
    messages: {
      getInbox: missing("messages.getInbox"),
      getDrafts: missing("messages.getDrafts"),
      getPermissions: missing("messages.getPermissions"),
      getRecipientQuickfilters: missing("messages.getRecipientQuickfilters"),
      getRecipientFilter: () => missing("messages.getRecipientFilter"),
      filterComposeRecipients: () => missing("messages.filterComposeRecipients"),
      searchRecipients: () => missing("messages.searchRecipients"),
      getSent: missing("messages.getSent"),
      getStatus: missing("messages.getStatus"),
      getReplyForm: () => missing("messages.getReplyForm"),
      getMessage: () => missing("messages.getMessage"),
    },
    profile: {
      getUserContactData: missing("profile.getUserContactData"),
      getUserEmail: missing("profile.getUserEmail"),
    },
    session: { getStatus: () => missing("session.getStatus") },
    timetable: {
      getTimeGrid: answer(paths.timeGrid, decodeTimeGrid),
      getGrid: () => missing("timetable.getGrid"),
      getFilter: (input) =>
        yearOf(input.start.slice(0, 10)).pipe(
          Effect.flatMap((year) =>
            answer(paths.filter(year, input.resourceType), decodeFilter, false),
          ),
        ),
      getEntriesSettings: () => missing("timetable.getEntriesSettings"),
      getMenu: missing("timetable.getMenu"),
      getCalendar: () => missing("timetable.getCalendar"),
      getExternalCalendar: () => missing("timetable.getExternalCalendar"),
      search: () => missing("timetable.search"),
      getAvailableRooms: () => missing("timetable.getAvailableRooms"),
      getEntries: (input) => Effect.map(entries(input), ({ decoded }) => decoded),
      getEntriesForResources: (input, entriesOptions) =>
        input.resources.length === 0
          ? Effect.fail(
              new InvalidRequestError({ path: "resources", message: "at least one resource" }),
            )
          : backwards(input).pipe(
              Effect.andThen(
                Effect.forEach(
                  options.reversed === true ? [...input.resources].reverse() : input.resources,
                  (resource) =>
                    entries({ ...input, resource }).pipe(
                      Effect.map(({ decoded, raw }) =>
                        entriesOptions?.raw === true
                          ? { resource, raw, result: Result.succeed(decoded) }
                          : { resource, result: Result.succeed(decoded) },
                      ),
                      Effect.catch((error) =>
                        Effect.succeed({ resource, result: Result.fail(error) }),
                      ),
                    ),
                ),
              ),
            ),
      getEntriesWeekOverview: () => missing("timetable.getEntriesWeekOverview"),
    },
  };

  return { client, log: Ref.get(log) };
});
