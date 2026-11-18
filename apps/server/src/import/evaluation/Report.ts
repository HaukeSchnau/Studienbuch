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
  /** `weekly` runs the import every Monday at 06:00, `timeline` every school day. */
  mode: Schema.Literals(["weekly", "timeline"]),
  weeks: Schema.Array(Schema.String),
  views: Schema.Struct({ student: View, teacher: View, room: View }),
  changes: Fraction,
  closures: Fraction,
  exams: Fraction,
  examStudents: Schema.Struct({ recall: Fraction, precision: Fraction }),
  weekLabels: Fraction,
  alternation: Fraction,
  /** Entries whose course id stayed the same from one run to the next. */
  courseIdsKept: Fraction,
  invariants: Schema.Struct({
    secondRunChanges: Schema.Int,
    reversedReadChanges: Schema.Int,
    deletedOnFailure: Schema.Int,
    injectedFailures: Schema.Int,
  }),
  reads: Schema.Struct({
    runs: Schema.Int,
    requests: Schema.Int,
    notCaptured: Schema.Int,
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
    line("Closure days right", report.closures),
    line("Exams right", report.exams),
    line("Exams shown to their students", report.examStudents.recall),
    line("Exams shown that are theirs", report.examStudents.precision),
    line("Week labels right", report.weekLabels),
    line("Alternating courses on one label", report.alternation),
    "",
    `  A second run changed ${report.invariants.secondRunChanges} rows, reversed reads ${report.invariants.reversedReadChanges}.`,
    `  ${report.invariants.injectedFailures} injected read failures deleted ${report.invariants.deletedOnFailure} rows.`,
    `  ${report.reads.runs} runs made ${report.reads.requests} requests; ${report.reads.notCaptured} weren't captured, ${report.reads.decodeFailures} didn't decode.`,
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
