/**
 * What one evaluation measured, as JSON for a baseline and as text for a terminal. Both carry
 * counts, dates and resource tokens, never corpus content (m2-import-corpus.md, section 6).
 */
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

export * as Report from "./Report.ts";

export const Fraction = Schema.Struct({ right: Schema.Int, of: Schema.Int });

export type Fraction = typeof Fraction.Type;

const View = Schema.Struct({
  /** Weeks exactly right: every entry covered once, every lesson needed, every attribute right. */
  weeks: Fraction,
  recall: Fraction,
  precision: Fraction,
  attributes: Fraction,
});

export const Evaluation = Schema.Struct({
  corpus: Schema.String,
  import: Schema.String,
  /** `weekly` runs the import every Monday at 06:00; `timeline` at 06:00 and at noon every school day. */
  mode: Schema.Literals(["weekly", "timeline"]),
  weeks: Schema.Array(Schema.String),
  /** Students count only in the weeks after their term's two opening weeks, the Kurswahl's source. */
  views: Schema.Struct({ student: View, teacher: View, room: View }),
  /**
   * Students whose Kurswahl, taken from the store after their term's opening weeks, gives them
   * exactly their entries of those weeks, added ones aside.
   */
  kurswahl: Fraction,
  /** Courses with lessons in the scored weeks that no student's Kurswahl names. */
  ghostCourses: Schema.Int,
  changes: Fraction,
  /** Labelled entries that belong to one course, or to different ones. */
  courses: Fraction,
  closures: Schema.Struct({ recall: Fraction, precision: Fraction }),
  /** Our lessons' claims of WebUntis entries that the truth holds. */
  links: Fraction,
  exams: Fraction,
  examStudents: Schema.Struct({ recall: Fraction, precision: Fraction }),
  weekLabels: Fraction,
  /** Entries two consecutive stores both hold whose course id stayed the same. */
  courseIdsKept: Fraction,
  /** After each run, the entries of the next seven days that the store holds. */
  lookahead: Fraction,
  runs: Schema.Struct({ total: Schema.Int, failed: Schema.Int }),
  /** School days of views WebUntis hid from the capture's account, which nothing measures. */
  hiddenDays: Schema.Int,
  /** The first measured run, repeated. Every count but `injectedFailures` must be 0. */
  invariants: Schema.Struct({
    failedRuns: Schema.Int,
    /** Lessons and exams in the final store that name a course it lacks. */
    danglingCourses: Schema.Int,
    /** Lessons of the measured weeks that the projection keeps out of the publish. */
    unpublishedLessons: Schema.Int,
    secondRunChanges: Schema.Int,
    reversedReadChanges: Schema.Int,
    failedReadChanges: Schema.Int,
    injectedFailures: Schema.Int,
  }),
  reads: Schema.Struct({
    requests: Schema.Int,
    outOfRange: Schema.Int,
    decodeFailures: Schema.Int,
  }),
  /** Ids of the labelled cases that pass. */
  passingCases: Schema.Array(Schema.String),
  /** The student-weeks with the most errors. */
  worst: Schema.Array(
    Schema.Struct({
      student: Schema.String,
      week: Schema.String,
      missing: Schema.Int,
      extra: Schema.Int,
      wrong: Schema.Int,
    }),
  ),
});

export type Evaluation = typeof Evaluation.Type;

export const Json = Schema.fromJsonString(Evaluation, { space: 2 });

/** Every number of an evaluation: all but the worst weeks, which name students' tokens. */
export const Aggregates = Evaluation.mapFields(Struct.omit(["worst"]));

export type Aggregates = typeof Aggregates.Type;

const percent = ({ right, of }: Fraction) =>
  of === 0 ? "   n/a" : `${((100 * right) / of).toFixed(1).padStart(5)}%`;

const right = ({ right: count, of }: Fraction) => `${count} of ${of}`;

type Row = readonly [label: string, value: (report: Aggregates) => Fraction];

/** The headline numbers, then the rest. */
const rows: ReadonlyArray<ReadonlyArray<Row>> = [
  [
    ["Student-weeks exactly right", (report) => report.views.student.weeks],
    ["Student lesson recall", (report) => report.views.student.recall],
    ["Student lesson precision", (report) => report.views.student.precision],
    ["Kurswahl exactly right", (report) => report.kurswahl],
    ["Teacher lesson recall", (report) => report.views.teacher.recall],
    ["Teacher lesson precision", (report) => report.views.teacher.precision],
    ["Room lesson recall", (report) => report.views.room.recall],
    ["Room lesson precision", (report) => report.views.room.precision],
    ["Changes right", (report) => report.changes],
    ["Course ids kept between runs", (report) => report.courseIdsKept],
  ],
  [
    ["Student attributes right", (report) => report.views.student.attributes],
    ["Teacher-weeks exactly right", (report) => report.views.teacher.weeks],
    ["Room-weeks exactly right", (report) => report.views.room.weeks],
    ["Labelled courses right", (report) => report.courses],
    ["Links to entries that exist", (report) => report.links],
    ["Closed days we close", (report) => report.closures.recall],
    ["Days we close that are closed", (report) => report.closures.precision],
    ["Exams right", (report) => report.exams],
    ["Exams shown to their students", (report) => report.examStudents.recall],
    ["Exams shown that are theirs", (report) => report.examStudents.precision],
    ["Week labels right", (report) => report.weekLabels],
    ["Next seven days in the store", (report) => report.lookahead],
  ],
];

/** The counts that aren't fractions, in a sentence each. */
const sentences = (report: Aggregates) => [
  `${report.runs.failed} of ${report.runs.total} runs failed; they made ${report.reads.requests} requests, ${report.reads.outOfRange} for days outside the capture, and ${report.reads.decodeFailures} bodies didn't decode.`,
  `${report.invariants.danglingCourses} lessons and exams name a course the store lacks; the projection keeps ${report.invariants.unpublishedLessons} out of the publish.`,
  `${report.ghostCourses} courses have lessons no student chose.`,
  `WebUntis hid ${report.hiddenDays} days of views from the capture's account; they aren't measured.`,
  `Repeating the first run: ${report.invariants.failedRuns} failed, a second run changed ${report.invariants.secondRunChanges} rows, reversed reads ${report.invariants.reversedReadChanges}, ${report.invariants.injectedFailures} failed reads ${report.invariants.failedReadChanges}.`,
  `Labelled cases passing: ${report.passingCases.length === 0 ? "none" : report.passingCases.join(", ")}`,
];

/** The headline numbers first, then the rest and the worst weeks. */
export const format = (report: Evaluation) =>
  [
    `${report.import} on ${report.corpus}, ${report.mode}, ${report.weeks.join(", ")}`,
    ...rows.flatMap((group) => [
      "",
      ...group.map(
        ([label, value]) =>
          `  ${label.padEnd(30)} ${percent(value(report))}  ${right(value(report))}`,
      ),
    ]),
    "",
    ...sentences(report).map((sentence) => `  ${sentence}`),
    ...(report.worst.length === 0
      ? []
      : [
          "",
          "  Worst student-weeks (missing, extra, wrong):",
          ...report.worst.map(
            (each) =>
              `    ${each.student.padEnd(10)} ${each.week}  ${each.missing} ${each.extra} ${each.wrong}`,
          ),
        ]),
  ].join("\n");

/** A weekly and a timeline evaluation side by side, as a Markdown table for a pull request. */
export const markdown = (weekly: Aggregates, timeline: Aggregates) =>
  [
    "| | Weekly | Timeline |",
    "| --- | ---: | ---: |",
    ...rows
      .flat()
      .map(
        ([label, value]) =>
          `| ${label} | ${percent(value(weekly)).trim()} (${right(value(weekly))}) | ${percent(value(timeline)).trim()} (${right(value(timeline))}) |`,
      ),
    "",
    ...sentences(weekly).map((sentence) => `- Weekly: ${sentence}`),
    ...sentences(timeline).map((sentence) => `- Timeline: ${sentence}`),
  ].join("\n");
