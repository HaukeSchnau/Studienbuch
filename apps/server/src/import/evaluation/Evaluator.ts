/**
 * Runs an import at 06:00 every Monday, or every school day in timeline mode, on what WebUntis
 * showed by then and the store the last run left, and measures the final store against the truth
 * (m2-import-corpus.md, section 6). The first run repeats to check what must never change.
 */
import { WebUntisClient } from "@schnau/webuntis-api";
import { School } from "@stu/core";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import type { Corpus } from "../corpus/Corpus.ts";
import { SchoolImport } from "../SchoolImport.ts";
import { Metrics } from "./Metrics.ts";
import type { Report } from "./Report.ts";
import { Truth } from "./Truth.ts";

export * as Evaluator from "./Evaluator.ts";

export interface Options {
  readonly corpus: Corpus.Corpus;
  readonly corpusName: string;
  readonly importName: string;
  readonly importLayer: Layer.Layer<SchoolImport.Service, never, WebUntisClient>;
  /** ISO weeks to measure, such as `2026-W45`, inclusive. All captured weeks by default. */
  readonly weeks: Option.Option<{ readonly from: string; readonly to: string }>;
  readonly timeline: boolean;
}

/** 06:00 at the school on `day`, as the instant a run starts. */
const morning = (day: string, timeZone: string) =>
  DateTime.toUtc(
    DateTime.makeZonedUnsafe(
      {
        year: Number(day.slice(0, 4)),
        month: Number(day.slice(5, 7)),
        day: Number(day.slice(8, 10)),
        hour: 6,
      },
      { timeZone, adjustForTimeZone: true },
    ),
  );

/** Our lessons in the truth's terms: teachers, rooms and entries through their links. */
const lessonsOf = (state: SchoolImport.ImportResult): ReadonlyArray<Metrics.Lesson> => {
  const refs = new Map(state.links.map((link) => [link.id, link.refs]));

  const providerIds = (ids: ReadonlyArray<string>, type: "TEACHER" | "ROOM") =>
    ids.flatMap((id) =>
      (refs.get(id) ?? []).flatMap((ref) =>
        ref._tag === "Resource" && ref.type === type ? [ref.id] : [],
      ),
    );

  return state.lessons.map((lesson) => ({
    id: lesson.id,
    courseId: lesson.courseId,
    date: lesson.date,
    start: lesson.start,
    end: lesson.end,
    status: lesson.status,
    teachers: providerIds(lesson.teacherIds, "TEACHER"),
    rooms: providerIds(lesson.roomIds, "ROOM"),
    previousTeachers: providerIds(lesson.change?.previousTeacherIds ?? [], "TEACHER"),
    previousRooms: providerIds(lesson.change?.previousRoomIds ?? [], "ROOM"),
    kind: lesson.change?.kind,
    entries: (refs.get(lesson.id) ?? []).flatMap((ref) =>
      ref._tag === "Entry" ? [{ date: ref.date, ids: ref.ids }] : [],
    ),
  }));
};

export const evaluate = Effect.fn("Evaluator.evaluate")(function* (options: Options) {
  const { corpus } = options;
  const truth = yield* Truth.build(corpus);
  const weekOf = (day: string) => truth.weekOf.get(day) ?? "";

  const weeks = [...new Set(truth.days.map(weekOf))]
    .sort()
    .filter(
      (week) =>
        Option.isNone(options.weeks) ||
        (options.weeks.value.from <= week && week <= options.weeks.value.to),
    );

  const measured = new Set(weeks);
  const days = truth.days.filter((day) => measured.has(weekOf(day)));
  const measuredDays = new Set(days);

  const starts = options.timeline
    ? days
    : weeks.flatMap((week) => days.find((day) => weekOf(day) === week) ?? []);

  const school = School.Id.make(corpus.manifest.id);

  /** One run at 06:00 on `day`. A run that fails leaves the store as it was. */
  const run = Effect.fn("Evaluator.run")(function* (
    day: string,
    previous: Option.Option<SchoolImport.ImportResult>,
    recorded: Omit<RecordedWebUntis.Options, "asOf"> = {},
  ) {
    const now = morning(day, corpus.manifest.timeZone);
    const { client, log } = yield* RecordedWebUntis.make(corpus.reads, { asOf: now, ...recorded });

    const exit = yield* SchoolImport.Service.use((service) =>
      service.run({ school, now, previous }),
    ).pipe(
      Effect.provide(
        options.importLayer.pipe(Layer.provide(Layer.succeed(WebUntisClient)(client))),
      ),
      Effect.exit,
    );

    const before = Option.getOrElse(previous, () => SchoolImport.empty);

    return {
      state: Exit.isSuccess(exit) ? SchoolImport.apply(before, exit.value) : before,
      log: yield* log,
    };
  });

  const states: Array<SchoolImport.ImportResult> = [];
  const logs: Array<RecordedWebUntis.Log> = [];

  for (const day of starts) {
    const { state, log } = yield* run(day, Option.fromNullishOr(states.at(-1)));

    states.push(state);
    logs.push(log);
  }

  const final = states.at(-1) ?? SchoolImport.empty;
  const ours = lessonsOf(final);
  const inWeek = (week: string) => (date: string) => weekOf(date) === week;

  // A student's courses are held for a term, as a Kurswahl would be: those of their entries in its
  // first two full weeks, added ones aside. A changed or cancelled lesson is still their course.
  const termOf = (day: string) =>
    corpus.cases.terms.find((term) => term.start <= day && day <= term.end)?.id;

  const fullWeeks = weeks.filter((week) => days.filter((day) => weekOf(day) === week).length === 5);

  const students = truth.views.filter((view) => view.type === "STUDENT");
  const enrollments = new Map<string, ReadonlySet<string>>();

  const enrollmentOf = (student: Truth.View, term: string | undefined) => {
    const key = `${student.id} ${term}`;

    const opening = new Set(
      fullWeeks
        .filter((week) => days.some((day) => weekOf(day) === week && termOf(day) === term))
        .slice(0, 2),
    );

    const courses =
      enrollments.get(key) ??
      Metrics.enrollment(
        student.entries.filter(
          (entry) => entry.status !== "Added" && opening.has(weekOf(entry.date)),
        ),
        ours,
      );

    enrollments.set(key, courses);

    return courses;
  };

  const viewWeeks = (type: Truth.ViewType) =>
    truth.views
      .filter((view) => view.type === type)
      .flatMap((view) =>
        weeks.map((week) => {
          const truthEntries = view.entries.filter((entry) => inWeek(week)(entry.date));
          const term = termOf(days.find(inWeek(week)) ?? "");
          const courses = type === "STUDENT" ? enrollmentOf(view, term) : new Set<string>();

          const mine = ours.filter(
            (lesson) =>
              inWeek(week)(lesson.date) &&
              (type === "STUDENT"
                ? courses.has(lesson.courseId)
                : (type === "TEACHER" ? lesson.teachers : lesson.rooms).includes(view.id)),
          );

          return { view, week, score: Metrics.scoreView(truthEntries, mine) };
        }),
      );

  const studentWeeks = viewWeeks("STUDENT");

  const changes = Metrics.scoreChanges(
    truth.changes.filter((entry) => measuredDays.has(entry.date)),
    corpus.cases.changes,
    ours,
  );

  const closedIn =
    (closures: ReadonlyArray<{ readonly start: string; readonly end: string }>) => (day: string) =>
      closures.some((closure) => closure.start <= day && day <= closure.end);

  const ourLabel = (week: string) => final.weeks.find((each) => each.week === week)?.label;
  const labelled = corpus.cases.weeks.filter((each) => measured.has(each.week));
  const labelsRight = labelled.filter((each) => ourLabel(each.week) === each.label);

  const closureCases = corpus.cases.closures.filter((closure) =>
    days.some((day) => closure.start <= day && day <= closure.end),
  );

  const closuresPassing = closureCases.filter((closure) =>
    days
      .filter((day) => closure.start <= day && day <= closure.end)
      .every(closedIn(final.closures)),
  );

  const examRefs = new Map(
    final.links.map((link) => [
      link.id,
      link.refs.flatMap((ref) => (ref._tag === "Exam" ? [ref.id] : [])),
    ]),
  );

  const examsByTerm = [...new Set(days.map(termOf))].map((term) =>
    Metrics.scoreExams(
      truth.exams.filter((exam) => measuredDays.has(exam.date) && termOf(exam.date) === term),
      final.exams
        .filter((exam) => measuredDays.has(exam.date) && termOf(exam.date) === term)
        .map((exam) => ({ ...exam, examIds: examRefs.get(exam.id) ?? [] })),
      new Map(students.map((student) => [student.id, enrollmentOf(student, term)])),
    ),
  );

  const exams = {
    exams: examsByTerm.map((each) => each.exams).reduce(Metrics.add, Metrics.fraction(0, 0)),
    students: {
      recall: examsByTerm
        .map((each) => each.students.recall)
        .reduce(Metrics.add, Metrics.fraction(0, 0)),
      precision: examsByTerm
        .map((each) => each.students.precision)
        .reduce(Metrics.add, Metrics.fraction(0, 0)),
    },
  };

  const churn = states
    .slice(1)
    .map((state, index) =>
      Metrics.courseChurn(truth.entries, lessonsOf(states[index] ?? state), lessonsOf(state)),
    )
    .reduce(Metrics.add, Metrics.fraction(0, 0));

  const first = starts[0] ?? days[0] ?? corpus.manifest.ranges[0]?.start ?? "";
  const once = (yield* run(first, Option.none())).state;
  const again = (yield* run(first, Option.some(once))).state;
  const reversed = (yield* run(first, Option.none(), { reversed: true })).state;

  const failing = yield* run(first, Option.some(once), {
    failures: { seed: "import-eval", oneIn: 3 },
  });

  return {
    corpus: options.corpusName,
    import: options.importName,
    mode: options.timeline ? "timeline" : "weekly",
    weeks,
    views: {
      student: Metrics.summarize(studentWeeks.map(({ score }) => score)),
      teacher: Metrics.summarize(viewWeeks("TEACHER").map(({ score }) => score)),
      room: Metrics.summarize(viewWeeks("ROOM").map(({ score }) => score)),
    },
    changes: changes.score,
    closures: Metrics.scoreClosures(
      days,
      closedIn(corpus.cases.closures),
      closedIn(final.closures),
    ),
    exams: exams.exams,
    examStudents: exams.students,
    weekLabels: Metrics.fraction(labelsRight.length, labelled.length),
    alternation: Metrics.scoreAlternation(ours, weekOf, weeks, ourLabel),
    courseIdsKept: Metrics.fraction(churn.of - churn.right, churn.of),
    invariants: {
      secondRunChanges: Metrics.differences(once, again),
      reversedReadChanges: Metrics.differences(once, reversed),
      deletedOnFailure: Metrics.deleted(once, failing.state),
      injectedFailures: failing.log.injected.length,
    },
    reads: {
      runs: logs.length,
      requests: logs.reduce((total, log) => total + log.requests, 0),
      notCaptured: logs.reduce((total, log) => total + log.notCaptured.length, 0),
      decodeFailures: logs.reduce((total, log) => total + log.decodeFailures.length, 0),
    },
    passingCases: [
      ...changes.passing,
      ...labelsRight.map((each) => each.id),
      ...closuresPassing.map((each) => each.id),
    ].sort(),
    worst: studentWeeks
      .map(({ view, week, score }) => ({
        student: view.name,
        week,
        missing: score.truth - score.covered,
        extra: score.ours - score.precise,
        wrong: score.covered - score.right,
      }))
      .filter((each) => each.missing + each.extra + each.wrong > 0)
      .sort(
        (a, b) =>
          b.missing + b.extra + b.wrong - (a.missing + a.extra + a.wrong) ||
          (a.student < b.student ? -1 : a.student > b.student ? 1 : 0) ||
          (a.week < b.week ? -1 : 1),
      )
      .slice(0, 10),
  } satisfies Report.Evaluation;
});
