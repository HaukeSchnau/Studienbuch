/**
 * Runs an import at 06:00 every Monday of the capture, or every school day in timeline mode, on
 * what WebUntis showed by then and the store the last run left, and measures the final store
 * (m2-import-corpus.md, section 6). The first measured run repeats to check what must not change.
 */
import { WebUntisClient } from "@schnau/webuntis-api";
import { School } from "@stu/core";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
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

/**
 * The import read what the corpus should hold and doesn't, so the corpus is wrong, not the
 * import. Days outside the captured ranges are normal and don't count.
 */
export class NotCaptured extends Schema.TaggedError<
  NotCaptured,
  { readonly brand: unique symbol }
>()("Evaluator.NotCaptured", { reads: Schema.Array(Schema.String) }) {}

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
  const captured = [...new Set(truth.days.map(weekOf))].sort();

  const weeks = captured.filter(
    (week) =>
      Option.isNone(options.weeks) ||
      (options.weeks.value.from <= week && week <= options.weeks.value.to),
  );

  const measured = new Set(weeks);
  const days = truth.days.filter((day) => measured.has(weekOf(day)));
  const measuredDays = new Set(days);
  const timeZone = corpus.manifest.timeZone;
  const school = School.Id.make(corpus.manifest.id);

  /** One run at 06:00 on `day`. A run that fails leaves the store as it was, and says so. */
  const run = Effect.fn("Evaluator.run")(function* (
    day: string,
    previous: Option.Option<SchoolImport.ImportResult>,
    recorded: Omit<RecordedWebUntis.Options, "asOf" | "captured"> = {},
  ) {
    const now = morning(day, timeZone);

    const { client, log } = yield* RecordedWebUntis.make(corpus.reads, {
      asOf: now,
      captured: corpus.manifest.ranges,
      ...recorded,
    });

    // The import gets the stored rows and links. What earlier runs covered is the store's
    // business: a result that repeated it would delete by an old read.
    const stored = Option.map(previous, (state) => ({ ...state, covers: [], diagnostics: [] }));

    const exit = yield* SchoolImport.Service.use((service) =>
      service.run({ school, now, previous: stored }),
    ).pipe(
      Effect.provide(
        options.importLayer.pipe(Layer.provide(Layer.succeed(WebUntisClient)(client))),
      ),
      Effect.exit,
    );

    const before = Option.getOrElse(previous, () => SchoolImport.empty);

    return {
      day,
      state: Exit.isSuccess(exit) ? SchoolImport.apply(before, exit.value) : before,
      covers: Exit.isSuccess(exit) ? exit.value.covers : [],
      failed: Exit.isFailure(exit),
      log: yield* log,
    };
  });

  // The runs span the whole capture, so the store holds every term's opening weeks whichever
  // weeks are measured.
  const starts = options.timeline
    ? truth.days
    : captured.flatMap((week) => truth.days.find((day) => weekOf(day) === week) ?? []);

  const runs: Array<Effect.Success<ReturnType<typeof run>>> = [];

  for (const day of starts) {
    runs.push(yield* run(day, Option.fromNullishOr(runs.at(-1)?.state)));
  }

  // The first measured run, repeated: as a second run, with reversed reads and with failing reads.
  const first = starts.find((day) => measuredDays.has(day)) ?? days[0] ?? "";
  const base = yield* run(first, Option.none());
  const again = yield* run(first, Option.some(base.state));
  const reversed = yield* run(first, Option.none(), { reversed: true });

  const failing = yield* run(first, Option.some(base.state), {
    failures: { seed: "import-eval", oneIn: 3 },
  });

  const gaps = [
    ...new Set([...runs, base, again, reversed, failing].flatMap((each) => each.log.notCaptured)),
  ].sort();

  if (gaps.length > 0) return yield* new NotCaptured({ reads: gaps });

  const final = runs.at(-1)?.state ?? SchoolImport.empty;
  const ours = lessonsOf(final);
  const index = Metrics.byEntry(ours);
  const inWeek = (week: string) => (date: string) => weekOf(date) === week;

  // A student's courses are held for a term, as a Kurswahl would be: those of their entries in
  // the term's first two full captured weeks, added ones aside. Only later weeks measure them.
  const termOf = (day: string) =>
    corpus.cases.terms.find((term) => term.start <= day && day <= term.end)?.id;

  const opening = (term: string | undefined) =>
    new Set(
      captured
        .filter((week) => {
          const weekDays = truth.days.filter(inWeek(week));

          return weekDays.length === 5 && weekDays.every((day) => termOf(day) === term);
        })
        .slice(0, 2),
    );

  const termOfWeek = (week: string) => termOf(truth.days.find(inWeek(week)) ?? "");
  const students = truth.views.filter((view) => view.type === "STUDENT");
  const enrollments = new Map<string, ReadonlySet<string>>();

  const enrollmentOf = (student: Truth.View, term: string | undefined) => {
    const key = `${student.id} ${term}`;
    const weeksOfTerm = opening(term);

    const courses =
      enrollments.get(key) ??
      Metrics.enrollment(
        student.entries.filter(
          (entry) => entry.status !== "Added" && weeksOfTerm.has(weekOf(entry.date)),
        ),
        index,
      );

    enrollments.set(key, courses);

    return courses;
  };

  const lessonsIn = new Map<string, Array<Metrics.Lesson>>();

  for (const lesson of ours) {
    lessonsIn.set(weekOf(lesson.date), [...(lessonsIn.get(weekOf(lesson.date)) ?? []), lesson]);
  }

  // Students are scored only on weeks after both of their term's opening weeks.
  const held = (week: string) => {
    const openingWeeks = [...opening(termOfWeek(week))];

    return openingWeeks.length === 2 && openingWeeks.every((each) => each < week);
  };

  const viewWeeks = (type: Truth.ViewType) =>
    truth.views
      .filter((view) => view.type === type)
      .flatMap((view) =>
        weeks
          .filter((week) => view.weeks.has(week) && (type !== "STUDENT" || held(week)))
          .map((week) => {
            const courses =
              type === "STUDENT" ? enrollmentOf(view, termOfWeek(week)) : new Set<string>();

            const mine = (lessonsIn.get(week) ?? []).filter((lesson) =>
              type === "STUDENT"
                ? courses.has(lesson.courseId)
                : (type === "TEACHER" ? lesson.teachers : lesson.rooms).includes(view.id),
            );

            return {
              view,
              week,
              score: Metrics.scoreView(
                view.entries.filter((entry) => inWeek(week)(entry.date)),
                mine,
              ),
            };
          }),
      );

  const studentWeeks = viewWeeks("STUDENT");

  const changes = Metrics.scoreChanges(
    truth.changes.filter((entry) => measuredDays.has(entry.date)),
    corpus.cases.changes,
    index,
  );

  const courses = Metrics.scoreCourses(
    corpus.cases.courses.filter((labelled) =>
      labelled.entries.every((entry) => measuredDays.has(entry.date)),
    ),
    index,
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

  const stores = runs.map((each) => Metrics.byEntry(lessonsOf(each.state)));
  const measuredEntries = truth.entries.filter((entry) => measuredDays.has(entry.date));

  const kept = Metrics.sum(
    stores
      .slice(1)
      .map((after, position) =>
        Metrics.courseIdsKept(measuredEntries, stores[position] ?? new Map(), after),
      ),
  );

  // What a student can look up after each run: the lessons of the next seven days in the store.
  const lookahead = Metrics.sum(
    runs.flatMap((each, position) => {
      if (!measuredDays.has(each.day)) return [];

      const until = DateTime.formatIsoDate(
        DateTime.setZoneNamedUnsafe(
          DateTime.add(morning(each.day, timeZone), { days: 7 }),
          timeZone,
        ),
      );

      return [
        Metrics.held(
          truth.entries.filter((entry) => each.day < entry.date && entry.date <= until),
          stores[position] ?? new Map(),
        ),
      ];
    }),
  );

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
    courses: courses.score,
    closures: Metrics.scoreClosures(days, closedIn(truth.closures), closedIn(final.closures)),
    links: Metrics.scoreLinks(ours, truth.entries, (date) => measuredDays.has(date)),
    exams: Metrics.sum(examsByTerm.map((each) => each.exams)),
    examStudents: {
      recall: Metrics.sum(examsByTerm.map((each) => each.students.recall)),
      precision: Metrics.sum(examsByTerm.map((each) => each.students.precision)),
    },
    weekLabels: Metrics.fraction(labelsRight.length, labelled.length),
    courseIdsKept: kept,
    lookahead,
    runs: { total: runs.length, failed: runs.filter((each) => each.failed).length },
    invariants: {
      // A failing-reads rerun in which no read failed tested nothing, so it counts as failed.
      failedRuns: [
        base.failed,
        again.failed,
        reversed.failed,
        failing.failed || failing.log.injected.length === 0,
      ].filter(Boolean).length,
      danglingCourses: Metrics.dangling(final),
      secondRunChanges: Metrics.differences(base.state, again.state),
      reversedReadChanges: Metrics.differences(base.state, reversed.state),
      failedReadChanges: Metrics.differences(base.state, failing.state),
      injectedFailures: failing.log.injected.length,
    },
    reads: {
      requests: runs.reduce((count, each) => count + each.log.requests, 0),
      outOfRange: runs.reduce((count, each) => count + each.log.outOfRange.length, 0),
      decodeFailures: runs.reduce((count, each) => count + each.log.decodeFailures.length, 0),
    },
    passingCases: [
      ...changes.passing,
      ...courses.passing,
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
