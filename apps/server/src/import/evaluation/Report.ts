/**
 * What one evaluation measured, as JSON for a baseline and as text for a terminal. Both carry
 * counts, dates and resource tokens, never corpus content (m2-import-corpus.md, section 6).
 */
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";
import { CourseIdentity } from "./CourseIdentity.ts";

export * as Report from "./Report.ts";

export const Fraction = Schema.Struct({ right: Schema.Int, of: Schema.Int });

export type Fraction = typeof Fraction.Type;

export const Identity = Schema.Struct({
  realCourses: Schema.Int,
  /** Real courses whose entries are in more than one of our courses. */
  split: Schema.Int,
  ourCourses: Schema.Int,
  /** Our courses that cover entries of more than one real course. */
  merged: Schema.Int,
});

const CourseCase = Schema.Struct({
  kind: Schema.Literals(["split", "merged"]),
  term: Schema.String,
  subject: Schema.String,
  looksLike: Schema.Literals(CourseIdentity.looksLike),
  realCourses: Schema.Array(
    Schema.Struct({
      /** Tokens. */
      students: Schema.Array(Schema.String),
      /** Each entry's date and WebUntis ids, and the indexes of `ourCourses` that cover it. */
      entries: Schema.Array(
        Schema.Struct({ entry: Schema.String, courses: Schema.Array(Schema.Int) }),
      ),
    }),
  ),
  /** Our courses' ids. */
  ourCourses: Schema.Array(Schema.String),
});

export const View = Schema.Struct({
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
  /**
   * In each term whose opening weeks are measured: real courses, each a subject and the students
   * its entries are shown to, and our courses in the store the Kurswahl is taken from. In total
   * and by subject; a merge of several subjects counts in each.
   */
  courseIdentity: Schema.Struct({
    ...Identity.fields,
    subjects: Schema.Record(Schema.String, Identity),
  }),
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
  /** Each subject's worst splits and merges, most pieces first. */
  courseCases: Schema.Array(CourseCase),
});

export type Evaluation = typeof Evaluation.Type;

export const Json = Schema.fromJsonString(Evaluation, { space: 2 });

const cases = ["worst", "courseCases"] as const;

/** Every number of an evaluation: all but the worst weeks and cases, which name students' tokens. */
export const Aggregates = Evaluation.mapFields(Struct.omit(cases));

export const aggregates = (report: Evaluation): Aggregates => Struct.omit(report, cases);

export type Aggregates = typeof Aggregates.Type;

const percent = ({ right, of }: Fraction) => `${((100 * right) / of).toFixed(1).padStart(5)}%`;

const right = ({ right: count, of }: Fraction) => `${count} of ${of}`;

/**
 * A fraction of nothing is a measure the corpus can't support, such as teacher views in an export
 * of the source store, which holds none.
 */
const measured = (fraction: Fraction, line: (value: Fraction) => string) =>
  fraction.of === 0 ? "not measured" : line(fraction);

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
  // Both come from students' own views, which a corpus can lack.
  report.kurswahl.of === 0
    ? "Courses no student chose: not measured."
    : `${report.ghostCourses} courses have lessons no student chose.`,
  report.courseIdentity.realCourses === 0
    ? "Course identity: not measured."
    : `Course identity: ${report.courseIdentity.split} of ${report.courseIdentity.realCourses} real courses are split over several of ours, and ${report.courseIdentity.merged} of ${report.courseIdentity.ourCourses} of ours join several real courses.`,
  `WebUntis hid ${report.hiddenDays} days of views from the capture's account; they aren't measured.`,
  `Repeating the first run: ${report.invariants.failedRuns} failed, a second run changed ${report.invariants.secondRunChanges} rows, reversed reads ${report.invariants.reversedReadChanges}, ${report.invariants.injectedFailures} failed reads ${report.invariants.failedReadChanges}.`,
  `Labelled cases passing: ${report.passingCases.length === 0 ? "none" : report.passingCases.join(", ")}`,
];

const count = (value: number) => String(value).padStart(4);

/** The subjects we split or merge courses of. */
const bySubject = (report: Aggregates) => {
  const failing = Object.entries(report.courseIdentity.subjects).filter(
    ([, counts]) => counts.split + counts.merged > 0,
  );

  return failing.length === 0
    ? []
    : [
        "",
        "  Subjects whose real courses we split, and whose courses of ours merge real ones:",
        ...failing.map(
          ([subject, counts]) =>
            `    ${subject.padEnd(20)} ${count(counts.split)} of ${count(counts.realCourses)} split  ${count(counts.merged)} of ${count(counts.ourCourses)} merged`,
        ),
      ];
};

const listed = <A>(values: ReadonlyArray<A>, shown: number, line: (value: A) => string) => [
  ...values.slice(0, shown).map(line),
  ...(values.length > shown ? [`and ${values.length - shown} more`] : []),
];

/** A case's courses, then each real course's students and where its entries went. */
const caseLines = (each: Evaluation["courseCases"][number]) => [
  `    ${each.kind} ${each.subject} in ${each.term}, ${each.looksLike}: ${each.ourCourses
    .map((course, i) => `${i} ${course}`)
    .join(", ")}`,
  ...each.realCourses.flatMap((real) => [
    `      ${real.students.length} students: ${listed(real.students, 4, String).join(" ")}`,
    ...listed(
      real.entries,
      6,
      ({ entry, courses }) =>
        `${entry} in ${courses.length === 0 ? "none" : courses.join(" and ")}`,
    ).map((line) => `        ${line}`),
  ]),
];

/** The headline numbers first, then the rest and the worst weeks and courses. */
export const format = (report: Evaluation) =>
  [
    `${report.import} on ${report.corpus}, ${report.mode}, ${report.weeks.join(", ")}`,
    ...rows.flatMap((group) => [
      "",
      ...group.map(
        ([label, value]) =>
          `  ${label.padEnd(30)} ${measured(value(report), (each) => `${percent(each)}  ${right(each)}`)}`,
      ),
    ]),
    "",
    ...sentences(report).map((sentence) => `  ${sentence}`),
    ...bySubject(report),
    ...(report.courseCases.length === 0
      ? []
      : ["", "  Worst courses per subject:", ...report.courseCases.flatMap(caseLines)]),
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

/** A fraction as `93.4% (52192 of 55890)`, or as not measured. */
export const text = (fraction: Fraction) =>
  measured(fraction, (each) => `${percent(each).trim()} (${right(each)})`);

/** A weekly and a timeline evaluation side by side, as a Markdown table for a pull request. */
export const markdown = (weekly: Aggregates, timeline: Aggregates) =>
  [
    "| | Weekly | Timeline |",
    "| --- | ---: | ---: |",
    ...rows
      .flat()
      .map(([label, value]) => `| ${label} | ${text(value(weekly))} | ${text(value(timeline))} |`),
    "",
    ...sentences(weekly).map((sentence) => `- Weekly: ${sentence}`),
    ...sentences(timeline).map((sentence) => `- Timeline: ${sentence}`),
  ].join("\n");
