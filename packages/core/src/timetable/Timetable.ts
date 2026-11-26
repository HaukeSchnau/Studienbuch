/**
 * The timetable as the screens read it: the day the Übersicht shows, where a lesson stands at a
 * moment, free periods, double periods as one block, what changed, and when the Stand is old.
 * Core reads no clock, so the caller passes the school's moment (`CivilTime.momentIn`).
 */
import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as Equal from "effect/Equal";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import { CivilTime } from "../civil-time/CivilTime.ts";
import type { Closure } from "../school/Closure.ts";
import type { Lesson } from "../school/Lesson.ts";

export * as Timetable from "./Timetable.ts";

/** What the rules read of a lesson row. */
export type Timed = Pick<
  Lesson.Row,
  "courseId" | "date" | "start" | "end" | "teacherIds" | "roomIds" | "status" | "change"
>;

const minute = 60_000;

const sameDate = (a: CivilTime.PlainDate, b: CivilTime.PlainDate) => CivilTime.order(a, b) === 0;

/** Entfall or Freisetzung: the lesson doesn't take place. */
export const isOff = (lesson: Pick<Timed, "status" | "change">): boolean =>
  lesson.status === "Cancelled" ||
  lesson.change?.kind === "Cancelled" ||
  lesson.change?.kind === "Released";

/** Where a lesson stands at a moment. A lesson that is off is never running. */
export type Phase = "Over" | "Running" | "Later";

export const phase = (lesson: Timed, now: CivilTime.Moment): Phase => {
  const day = CivilTime.order(lesson.date, now.date);

  if (day < 0 || (day === 0 && lesson.end <= now.time)) return "Over";

  return day === 0 && lesson.start <= now.time && !isOff(lesson) ? "Running" : "Later";
};

/** The minutes until a lesson ends, counting the one begun: 50 at 10:30 for 11:20, 1 at 11:19. */
export const minutesLeft = (lesson: Pick<Timed, "end">, now: CivilTime.Moment): number =>
  Math.ceil((lesson.end - now.time) / minute);

/** A change that gets a note on the lesson. `Other` shows the school's stock phrase, if any. */
export type NoteKind = "Substitution" | "Supervised" | "RoomChange" | "Moved" | "Added" | "Other";

export type Change = Data.TaggedEnum<{
  /** The name is struck through: Entfall or Freisetzung. */
  Off: { readonly kind: "Cancelled" | "Released" };
  Note: { readonly kind: NoteKind; readonly text: string | undefined };
}>;

export const Change = Data.taggedEnum<Change>();

/** What changed about a lesson, one per lesson. `None` while it takes place as planned. */
export const change = (lesson: Pick<Timed, "status" | "change">): Option.Option<Change> => {
  const kind = lesson.change?.kind;

  if (lesson.status === "Cancelled" || kind === "Cancelled") {
    return Option.some(Change.Off({ kind: "Cancelled" }));
  }

  if (kind === "Released") return Option.some(Change.Off({ kind }));

  if (kind !== undefined && kind !== "Other") {
    return Option.some(Change.Note({ kind, text: undefined }));
  }

  const text = lesson.change?.text;

  // The import writes an added lesson's change as `Other`, which says less than "Added".
  if (lesson.status === "Added" && text === undefined) {
    return Option.some(Change.Note({ kind: "Added", text: undefined }));
  }

  return kind === undefined ? Option.none() : Option.some(Change.Note({ kind, text }));
};

/** Two halves of a double period at most this far apart are one block. */
const blockGap = 10 * minute;

const byTime: Order.Order<Timed> = Order.combineAll([
  Order.mapInput(CivilTime.order, (lesson: Timed) => lesson.date),
  Order.mapInput(Order.Number, (lesson: Timed) => lesson.start),
  Order.mapInput(Order.String, (lesson: Timed) => lesson.courseId),
]);

const joins = (first: Timed, second: Timed) =>
  second.start >= first.end &&
  second.start - first.end <= blockGap &&
  first.status === second.status &&
  Equal.equals(first.teacherIds, second.teacherIds) &&
  Equal.equals(first.roomIds, second.roomIds) &&
  Equal.equals(first.change, second.change);

/**
 * The lessons in order of date and start, with the halves of a double period as one lesson: two
 * lessons of a course on a day that touch and agree on teachers, rooms, status and change. A block
 * whose halves differ, as when only the second is cancelled, stays two lessons. The joined lesson
 * is the first half with the last half's end.
 */
export const blocks = <A extends Timed>(lessons: ReadonlyArray<A>): ReadonlyArray<A> => {
  const joined: Array<A> = [];
  const last = new Map<string, number>();

  for (const lesson of Arr.sort(lessons, byTime)) {
    const key = `${lesson.courseId} ${CivilTime.format(lesson.date)}`;
    const index = last.get(key);
    const before = index === undefined ? undefined : joined[index];

    if (index !== undefined && before !== undefined && joins(before, lesson)) {
      joined[index] = { ...before, end: lesson.end };
    } else {
      last.set(key, joined.length);
      joined.push(lesson);
    }
  }

  return joined;
};

/** A row of a day: a lesson, or a free period between two. */
export type Row<A> = Data.TaggedEnum<{
  Lesson: { readonly lesson: A };
  Free: { readonly start: number; readonly end: number };
}>;

interface RowDefinition extends Data.TaggedEnum.WithGenerics<1> {
  readonly taggedEnum: Row<this["A"]>;
}

export const Row = Data.taggedEnum<RowDefinition>();

/**
 * The day's `blocks` in order, with a free period at each start of the `week`'s published lessons
 * (halves of double periods too) that the day leaves empty between its first and last lesson, up
 * to the next start. A long lunch break starts no lesson, so it is never a free period.
 */
export const day = <A extends Timed>(
  lessons: ReadonlyArray<A>,
  week: ReadonlyArray<Timed>,
): ReadonlyArray<Row<A>> => {
  const sorted = Arr.sort(lessons, byTime);
  const first = sorted[0];
  const last = sorted.at(-1);

  if (first === undefined || last === undefined) return [];

  const starts = Arr.sort(Arr.dedupe(week.map((lesson) => lesson.start)), Order.Number);

  const empty = starts.filter(
    (start) =>
      start > first.start &&
      start < last.start &&
      !sorted.some((lesson) => lesson.start <= start && start < lesson.end),
  );

  const free = empty.map((start): Row<A> => {
    const next = [...sorted.map((lesson) => lesson.start), ...starts].filter((at) => at > start);
    const ends = week.flatMap((lesson) => (lesson.start === start ? [lesson.end] : []));

    return Row.Free({ start, end: Math.min(...next, ...ends) });
  });

  const rows: ReadonlyArray<Row<A>> = [
    ...sorted.map((lesson): Row<A> => Row.Lesson({ lesson })),
    ...free,
  ];

  return Arr.sort(
    rows,
    Order.mapInput(Order.Number, (row: Row<A>) =>
      row._tag === "Lesson" ? row.lesson.start : row.start,
    ),
  );
};

/** What the Übersicht's card shows. */
export type Shown<A> = Data.TaggedEnum<{
  /** A day's rows, today's while it has a lesson ahead, else the next school day's. */
  Day: { readonly date: CivilTime.PlainDate; readonly rows: ReadonlyArray<Row<A>> };
  /** The next school day is after the last day the school has published. */
  Unpublished: { readonly date: CivilTime.PlainDate };
  /** Today is in a closure: its name, its last day, and the day school resumes with its lesson. */
  Closed: {
    readonly name: string;
    readonly until: CivilTime.PlainDate;
    readonly resumes: CivilTime.PlainDate;
    readonly first: Option.Option<A>;
  };
  /** No timetable: no lesson ahead and no Stand. */
  None: {};
}>;

interface ShownDefinition extends Data.TaggedEnum.WithGenerics<1> {
  readonly taggedEnum: Shown<this["A"]>;
}

export const Shown = Data.taggedEnum<ShownDefinition>();

/** What the device holds of the school's timetable. */
export interface Plan<A extends Timed> {
  readonly lessons: ReadonlyArray<A>;
  readonly closures: ReadonlyArray<Pick<Closure.Row, "name" | "dates">>;
  /** `ImportStatus.coveredUntil`, absent while the school has no Stand. */
  readonly coveredUntil: CivilTime.PlainDate | undefined;
}

// A closure can't last longer than this, so the search for a school day ends.
const searchDays = 400;

/**
 * The day the Übersicht shows at `now`. Inside a closure, the closure. Else today while one of its
 * lessons that is not off hasn't ended, or before its first lesson even when all are off. Else the
 * next date outside closures with a lesson, up to `coveredUntil`, or the first school day after it.
 * A lesson the device still holds for a closure or after `coveredUntil` never shows.
 */
export const shown = <A extends Timed>(plan: Plan<A>, now: CivilTime.Moment): Shown<A> => {
  const lessons = blocks(plan.lessons);
  const on = (date: CivilTime.PlainDate) => lessons.filter((lesson) => sameDate(lesson.date, date));

  const closureOn = (date: CivilTime.PlainDate) =>
    Arr.findFirst(plan.closures, (closure) =>
      Arr.findFirst(closure.dates, (range) => CivilTime.contains(range, date)).pipe(
        Option.map((range) => ({ name: closure.name, until: range.end })),
      ),
    );

  const covered = (date: CivilTime.PlainDate) =>
    plan.coveredUntil === undefined || CivilTime.order(date, plan.coveredUntil) <= 0;

  const isSchoolDay = (date: CivilTime.PlainDate) =>
    Option.isNone(closureOn(date)) &&
    (CivilTime.dayOfWeek(date) <= 5 || lessons.some((lesson) => sameDate(lesson.date, date)));

  /** The first school day from `date` on, `date` itself included. */
  const schoolDayFrom = (date: CivilTime.PlainDate) =>
    Arr.findFirst(Arr.range(0, searchDays), (days) => {
      const candidate = CivilTime.addDays(date, days);

      return isSchoolDay(candidate) ? Option.some(candidate) : Option.none();
    }).pipe(Option.getOrElse(() => date));

  const dayOf = (date: CivilTime.PlainDate): Shown<A> => {
    const monday = CivilTime.addDays(date, 1 - CivilTime.dayOfWeek(date));
    const sunday = CivilTime.addDays(monday, 6);

    const week = plan.lessons.filter((lesson) =>
      CivilTime.contains({ start: monday, end: sunday }, lesson.date),
    );

    return Shown.Day({ date, rows: day(on(date), week) });
  };

  const closed = closureOn(now.date);

  if (Option.isSome(closed)) {
    const resumes = schoolDayFrom(CivilTime.addDays(closed.value.until, 1));

    return Shown.Closed({
      ...closed.value,
      resumes,
      first: covered(resumes)
        ? Arr.findFirst(on(resumes), (lesson) => !isOff(lesson))
        : Option.none(),
    });
  }

  const today = covered(now.date) ? on(now.date) : [];
  const firstStart = Math.min(...today.map((lesson) => lesson.start));

  if (
    today.some((lesson) => lesson.end > now.time && !isOff(lesson)) ||
    (today.length > 0 && now.time < firstStart)
  ) {
    return dayOf(now.date);
  }

  const next = Arr.findFirst(
    lessons,
    (lesson) =>
      CivilTime.order(lesson.date, now.date) > 0 &&
      covered(lesson.date) &&
      Option.isNone(closureOn(lesson.date)),
  );

  if (Option.isSome(next)) return dayOf(next.value.date);

  if (plan.coveredUntil === undefined) return Shown.None();

  const afterCovered = CivilTime.addDays(plan.coveredUntil, 1);
  // Today is still ahead when none of its lessons was published.
  const ahead = today.length === 0 ? now.date : CivilTime.addDays(now.date, 1);

  return Shown.Unpublished({
    date: schoolDayFrom(CivilTime.order(afterCovered, ahead) > 0 ? afterCovered : ahead),
  });
};

/** Once the import read this long ago, the Stand says so. */
export const staleAfter = 60 * minute;

// The import sleeps at night, so a Stand that ages then would be noise. Wall-clock times at the
// school. M2.6 settles the exact thresholds.
const awake = { from: (6 * 60 + 30) * minute, until: 22 * 60 * minute };

/**
 * When the import last read the school's timetable, as the school's clock showed it, once that is
 * more than an hour ago at a time the import runs. `None` while the Stand is fresh, and at night.
 */
export const staleSince = (
  observedAt: number,
  now: number,
  timeZone: CivilTime.TimeZone,
): Option.Option<CivilTime.Moment> => {
  const time = CivilTime.momentIn(now, timeZone).time;

  return now - observedAt > staleAfter && time >= awake.from && time < awake.until
    ? Option.some(CivilTime.momentIn(observedAt, timeZone))
    : Option.none();
};
