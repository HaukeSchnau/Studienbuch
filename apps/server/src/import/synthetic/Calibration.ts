/**
 * What a synthetic school is generated from: distributions measured on a real corpus, and nothing
 * else (D112, school-data-boundary.md). The file is public, so its format allows numbers only, no
 * string a corpus could leak through, and every number that counts people sits in a `people` field
 * that is 0 or at least five. Decoding refuses anything else.
 */
import * as Schema from "effect/Schema";

export * as Calibration from "./Calibration.ts";

/** The fewest people a published count may describe. */
export const fewestPeople = 5;

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** A number of people: none, or at least `fewestPeople`, so no count singles anyone out. */
export const People = Count.check(
  Schema.makeFilter<number>((people) => people === 0 || people >= fewestPeople, {
    expected: `0 or at least ${fewestPeople} people`,
  }),
);

/**
 * `count` units whose value lies in `from` to `to`. The units are groups of people, such as
 * courses, and `people` is how many different people the bin's units hold together.
 */
export const Bin = Schema.Struct({ from: Count, to: Count, count: Count, people: People });

export type Bin = typeof Bin.Type;

/** A distribution of people themselves: `people` of them have a value from `from` to `to`. */
export const PeopleBin = Schema.Struct({ from: Count, to: Count, people: People });

/** A distribution as bins in ascending order. */
export const Histogram = Schema.Array(Bin);

/**
 * Bins whose ends lie on multiples of `width`, for values that are a group's size: an end then
 * never tells the size of a real roster.
 */
const onBounds = (width: number) =>
  Schema.makeFilter<ReadonlyArray<{ readonly from: number; readonly to: number }>>(
    (bins) => bins.every(({ from, to }) => from % width === 0 && (to + 1) % width === 0),
    { expected: `bins whose ends are multiples of ${width}` },
  );

export const courseSizeWidth = 5;

export const hiddenWidth = 10;

export type Histogram = typeof Histogram.Type;

/** `count` units holding `people` people together, such as courses whose roster changed. */
export const Counted = Schema.Struct({ count: Count, people: People });

export type Counted = typeof Counted.Type;

/** A rate per thousand entries in a week, as bins of weeks. Weeks count no people. */
export const WeekBin = Schema.Struct({ from: Count, to: Count, count: Count });

export const Cohort = Schema.Struct({
  grade: Count,
  /** Its students, in the latest term measured. */
  people: People,
  /** Its lasting classes, 0 where the cohort is one class resource. */
  classes: Count,
  /** Courses taught to one class alone, per term and class, as a distribution over classes. */
  classCourses: Histogram,
  /** Courses meeting in the same slots, as how many courses a Kopplung holds. */
  kopplungen: Histogram,
  /** The share of the cohort's students a Kopplung's courses hold, in percent. */
  kopplungShare: Histogram,
  /** Students per course, in bins of five, so no bin's ends are a small roster's size. */
  courseSize: Histogram.check(onBounds(courseSizeWidth)),
  /** A course's entries in a term's two opening weeks. */
  meetings: Histogram,
});

export type Cohort = typeof Cohort.Type;

export const Distributions = Schema.Struct({
  /** How many terms' opening weeks the course distributions add up. */
  terms: Count,
  cohorts: Schema.Array(Cohort),
  teachers: Schema.Struct({
    /** Teachers with an upper-school entry. */
    people: People,
    /** Teachers per course; `people` counts the teachers. */
    perCourse: Histogram,
  }),
  rooms: Schema.Struct({
    /** Rooms with an upper-school entry. Rooms count no people. */
    count: Count,
    /** Rooms per course. */
    perCourse: Histogram,
  }),
  /** The share of upper-school teachers' entries taught to lower-school classes, in percent. */
  lowerSchool: Schema.Struct({ classes: Count, share: Count }),
  /** Per week, entries of every thousand that WebUntis showed in each way. */
  changes: Schema.Struct({
    cancelled: Schema.Array(WeekBin),
    substituted: Schema.Array(WeekBin),
    roomChanged: Schema.Array(WeekBin),
    added: Schema.Array(WeekBin),
  }),
  /** Exams per course and term. */
  exams: Histogram,
  /** Students whose timetable WebUntis hid from some day on, by the share of captured days hidden. */
  hidden: Schema.Array(PeopleBin).check(onBounds(hiddenWidth)),
  /**
   * The pitfalls that broke the import (M2.10's course identity table), added up over the terms
   * measured. `people` counts the students involved: every member of the groups, only the movers
   * of a roster change. A shape whose people number fewer than five is left out.
   */
  pitfalls: Schema.Struct({
    /** Groups that share a subject code with another group of their classes, in other slots. */
    sameCodeApart: Schema.optionalKey(Counted),
    /** Groups that share a subject code with another group meeting at the same time. */
    sameCodeParallel: Schema.optionalKey(Counted),
    /** Courses of which some entries are shown to a larger group, such as the whole cohort. */
    sharedEntries: Schema.optionalKey(Counted),
    /** Courses whose roster changes within the opening weeks. */
    rosterChanges: Schema.optionalKey(Counted),
    /**
     * Courses students join after the opening weeks, which then meet in most of their weeks; its
     * people are the students who join.
     */
    lateJoins: Schema.optionalKey(Counted),
    /**
     * Events a cohort's classes attend together, such as a project week: entries without a subject
     * that nearly every student of their classes sees. Its people are those students.
     */
    events: Schema.optionalKey(Counted),
  }),
});

export type Calibration = typeof Distributions.Type;

/** The file as committed: the format exactly, and two-space JSON. */
export const Json = Schema.fromJsonString(Distributions, { space: 2 });

/** Refuses a field the format lacks, so the file can't carry a string through one. */
export const decode = Schema.decodeUnknownEffect(Json, { onExcessProperty: "error" });

export const encode = Schema.encodeEffect(Json);

/** A measured calibration, held to the format before anything writes it. */
export const decodeValue = Schema.decodeUnknownEffect(Distributions, { onExcessProperty: "error" });
