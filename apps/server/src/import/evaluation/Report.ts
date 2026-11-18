/**
 * What one evaluation measured, as JSON for a baseline and as text for a terminal. Both carry
 * counts, dates and resource tokens, never corpus content (m2-import-corpus.md, section 6).
 */
import * as Schema from "effect/Schema";

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

const percent = ({ right, of }: Fraction) =>
  of === 0 ? "   n/a" : `${((100 * right) / of).toFixed(1).padStart(5)}%`;

const line = (label: string, value: Fraction) =>
  `  ${label.padEnd(30)} ${percent(value)}  ${right(value)}`;

const right = ({ right: count, of }: Fraction) => `${count} of ${of}`;

/** The headline numbers first, then the rest and the worst weeks. */
export const format = (report: Evaluation) =>
  [
    `${report.import} on ${report.corpus}, ${report.mode}, ${report.weeks.join(", ")}`,
    "",
    line("Student-weeks exactly right", report.views.student.weeks),
    line("Student lesson recall", report.views.student.recall),
    line("Student lesson precision", report.views.student.precision),
    line("Kurswahl exactly right", report.kurswahl),
    line("Teacher lesson recall", report.views.teacher.recall),
    line("Teacher lesson precision", report.views.teacher.precision),
    line("Room lesson recall", report.views.room.recall),
    line("Room lesson precision", report.views.room.precision),
    line("Changes right", report.changes),
    line("Course ids kept between runs", report.courseIdsKept),
    "",
    line("Student attributes right", report.views.student.attributes),
    line("Teacher-weeks exactly right", report.views.teacher.weeks),
    line("Room-weeks exactly right", report.views.room.weeks),
    line("Labelled courses right", report.courses),
    line("Links to entries that exist", report.links),
    line("Closed days we close", report.closures.recall),
    line("Days we close that are closed", report.closures.precision),
    line("Exams right", report.exams),
    line("Exams shown to their students", report.examStudents.recall),
    line("Exams shown that are theirs", report.examStudents.precision),
    line("Week labels right", report.weekLabels),
    line("Next seven days in the store", report.lookahead),
    "",
    `  ${report.runs.failed} of ${report.runs.total} runs failed; they made ${report.reads.requests} requests, ${report.reads.outOfRange} for days outside the capture, and ${report.reads.decodeFailures} bodies didn't decode.`,
    `  ${report.invariants.danglingCourses} lessons and exams name a course the store lacks; the projection keeps ${report.invariants.unpublishedLessons} out of the publish.`,
    `  ${report.ghostCourses} courses have lessons no student chose.`,
    `  Repeating the first run: ${report.invariants.failedRuns} failed, a second run changed ${report.invariants.secondRunChanges} rows, reversed reads ${report.invariants.reversedReadChanges}, ${report.invariants.injectedFailures} failed reads ${report.invariants.failedReadChanges}.`,
    `  Labelled cases passing: ${report.passingCases.length === 0 ? "none" : report.passingCases.join(", ")}`,
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
