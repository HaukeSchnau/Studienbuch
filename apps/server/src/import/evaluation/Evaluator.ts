/**
 * Runs an import at 06:00 every Monday of the capture, or every school day in timeline mode, on
 * what WebUntis showed by then and the store the last run left, and measures the final store
 * (m2-import-corpus.md, section 6). The first measured run repeats to check what must not change.
 */
import { WebUntisClient } from "@schnau/webuntis-api";
import { CivilTime } from "@stu/core";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import type { Corpus } from "../corpus/Corpus.ts";
import { SchoolProfile } from "../profiles/SchoolProfile.ts";
import { Projection } from "../Projection.ts";
import { SchoolImport } from "../SchoolImport.ts";
import { CourseIdentity } from "./CourseIdentity.ts";
import { Metrics } from "./Metrics.ts";
import type { Report } from "./Report.ts";
import { Students } from "./Students.ts";
import { Truth } from "./Truth.ts";

export * as Evaluator from "./Evaluator.ts";

export interface Options {
  readonly corpus: Corpus.Corpus;
  readonly corpusName: string;
  /** The school the corpus is of, whose rules the import reads. */
  readonly profile: SchoolProfile.SchoolProfile;
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

/** The weeks asked for hold none the corpus captured, so the numbers would measure nothing. */
export class NothingMeasured extends Schema.TaggedError<
  NothingMeasured,
  { readonly brand: unique symbol }
>()("Evaluator.NothingMeasured", { captured: Schema.Array(Schema.String) }) {}

/** `hour` o'clock at the school on `day`, as the instant a run starts. */
const at = (day: string, hour: number, timeZone: string) =>
  DateTime.toUtc(
    DateTime.makeZonedUnsafe(
      {
        year: Number(day.slice(0, 4)),
        month: Number(day.slice(5, 7)),
        day: Number(day.slice(8, 10)),
        hour,
      },
      { timeZone, adjustForTimeZone: true },
    ),
  );

/** When a run starts, and whether it is the nightly one that owns course structure. */
interface Start {
  readonly day: string;
  readonly hour: number;
  readonly nightly: boolean;
}

const nightlyRun = (day: string): Start => ({ day, hour: 6, nightly: true });

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

  if (weeks.length === 0) return yield* new NothingMeasured({ captured });

  const measured = new Set(weeks);
  const days = truth.days.filter((day) => measured.has(weekOf(day)));
  const measuredDays = new Set(days);
  const timeZone = corpus.manifest.timeZone;
  const decodeDay = Schema.decodeEffect(CivilTime.PlainDate);

  /**
   * One run over today to four weeks ahead. A run that fails leaves the store as it was, and says
   * so.
   */
  const run = Effect.fn("Evaluator.run")(function* (
    { day, hour, nightly }: Start,
    previous: Option.Option<SchoolImport.ImportResult>,
    recorded: Omit<RecordedWebUntis.Options, "asOf" | "captured"> = {},
  ) {
    const now = at(day, hour, timeZone);

    const { client, log } = yield* RecordedWebUntis.make(corpus.reads, {
      asOf: now,
      captured: corpus.manifest.ranges,
      ...recorded,
    });

    const today = yield* Effect.orDie(decodeDay(day));
    const window = { start: today, end: CivilTime.addDays(today, 27) };

    const exit = yield* SchoolImport.Service.use((service) =>
      service.run({ profile: options.profile, now, window, previous, nightly }),
    ).pipe(
      Effect.provide(
        options.importLayer.pipe(Layer.provide(Layer.succeed(WebUntisClient)(client))),
      ),
      Effect.exit,
    );

    const before = Option.getOrElse(previous, () => SchoolImport.empty);

    return {
      day,
      now,
      state: Exit.isSuccess(exit) ? SchoolImport.apply(before, exit.value) : before,
      covers: Exit.isSuccess(exit) ? exit.value.covers : [],
      failed: Exit.isFailure(exit),
      log: yield* log,
    };
  });

  // The runs span the whole capture, so the store holds every term's opening weeks whichever
  // weeks are measured. A timeline adds a daytime run at noon, which sees the morning's changes to
  // the rest of the day and creates no course.
  const starts = options.timeline
    ? truth.days.flatMap((day) => [nightlyRun(day), { day, hour: 12, nightly: false }])
    : captured.flatMap((week) => {
        const monday = truth.days.find((day) => weekOf(day) === week);

        return monday === undefined ? [] : [nightlyRun(monday)];
      });

  const inWeek = (week: string) => (date: string) => weekOf(date) === week;

  // A student's courses are held for a term, as a Kurswahl would be: those of their entries in
  // the term's first two full captured weeks, added ones aside. Only later weeks measure them.
  // A day no case labels is in its school year's half.
  const inTerm = (day: string) => (term: { readonly start: string; readonly end: string }) =>
    term.start <= day && day <= term.end;

  const termOf = (day: string) =>
    (corpus.cases.terms.find(inTerm(day)) ?? truth.halves.find(inTerm(day)))?.id;

  const openingWeeks = new Map(
    [...new Set(truth.days.map(termOf))].map((term) => [
      term,
      new Set(
        captured
          .filter((week) => {
            const weekDays = truth.days.filter(inWeek(week));

            return weekDays.length === 5 && weekDays.every((day) => termOf(day) === term);
          })
          .slice(0, 2),
      ),
    ]),
  );

  const opening = (term: string | undefined) => openingWeeks.get(term) ?? new Set<string>();

  const lastOpening = new Map(
    [...openingWeeks].map(([term, weeksOfTerm]) => [term, [...weeksOfTerm].sort().at(-1)]),
  );

  const measuredEntries = truth.entries.filter((entry) => measuredDays.has(entry.date));

  // Teachers, rooms and the lookahead count only what the import reads: entries taught to a class
  // of the profile's grade levels. A student's view is theirs whole.
  const upperSchool = (entry: Metrics.TruthEntry) =>
    entry.classes.some((name) =>
      Option.isSome(SchoolProfile.gradeLevelRead(options.profile, options.profile.classify(name))),
    );

  /**
   * What a student can look up after a run: the lessons of the next seven days in the store,
   * against what WebUntis showed when the run read them. Later changes are later runs' business.
   */
  const lookaheadOf = Effect.fnUntraced(function* (
    now: DateTime.Utc,
    store: ReadonlyMap<string, ReadonlyArray<Metrics.Lesson>>,
  ) {
    const dayIn = (days: number) =>
      DateTime.formatIsoDate(DateTime.setZoneNamedUnsafe(DateTime.add(now, { days }), timeZone));

    return Metrics.held(
      (yield* Truth.entriesAt(corpus, now, { start: dayIn(1), end: dayIn(7) })).filter(upperSchool),
      store,
    );
  });

  // Each run is measured as it lands, and only the last store and each term's opening store are
  // kept: a timeline's stores together need gigabytes.
  const runs: Array<Pick<Effect.Success<ReturnType<typeof run>>, "day" | "failed" | "log">> = [];
  const kept: Array<Metrics.Fraction> = [];
  const ahead: Array<Metrics.Fraction> = [];
  const openingStates = new Map<string | undefined, SchoolImport.ImportResult>();

  let last: Option.Option<{
    readonly state: SchoolImport.ImportResult;
    readonly store: ReadonlyMap<string, ReadonlyArray<Metrics.Lesson>>;
  }> = Option.none();

  for (const start of starts) {
    const { day, now, state, failed, log } = yield* run(
      start,
      Option.map(last, (each) => each.state),
    );

    const store = Metrics.byEntry(Metrics.lessonsOf(state));

    if (Option.isSome(last)) {
      kept.push(Metrics.courseIdsKept(measuredEntries, last.value.store, store));
    }

    if (measuredDays.has(day)) ahead.push(yield* lookaheadOf(now, store));

    // What a student chose from: the store after the last run of the term's opening weeks.
    for (const [term, week] of lastOpening) {
      if (week !== undefined && weekOf(day) <= week) openingStates.set(term, state);
    }

    runs.push({ day, failed, log });
    last = Option.some({ state, store });
  }

  // The first measured run, repeated: as a second run, with reversed reads and with failing reads.
  const first = nightlyRun(starts.find(({ day }) => measuredDays.has(day))?.day ?? days[0] ?? "");

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

  const final = Option.match(last, {
    onNone: () => SchoolImport.empty,
    onSome: (each) => each.state,
  });

  const ours = Metrics.lessonsOf(final);
  const index = Metrics.byEntry(ours);
  const termOfWeek = (week: string) => termOf(truth.days.find(inWeek(week)) ?? "");

  // A lesson WebUntis shows beyond its group isn't the other students'.
  const students = Students.attended(
    truth.views.filter((view) => view.type === "STUDENT"),
    termOf,
  );

  // What a student chose from: the store after the last run of the term's opening weeks. Later
  // runs never choose for them, so a course split or renamed after it shows as missing lessons.
  const openings = new Map<
    string | undefined,
    {
      readonly lessons: ReadonlyArray<Metrics.Lesson>;
      readonly index: ReadonlyMap<string, ReadonlyArray<Metrics.Lesson>>;
    }
  >();

  const openingStore = (term: string | undefined) => {
    const cached = openings.get(term);

    if (cached !== undefined) return cached;

    const lessons = Metrics.lessonsOf(openingStates.get(term) ?? SchoolImport.empty);
    const store = { lessons, index: Metrics.byEntry(lessons) };

    openings.set(term, store);

    return store;
  };

  const inOpening = (term: string | undefined) => (date: string) => opening(term).has(weekOf(date));

  const chooseIn = (student: Truth.View, term: string | undefined) =>
    Students.choose(
      student,
      inOpening(term),
      openingStore(term),
      Students.joined(
        openingStates.get(term) ?? SchoolImport.empty,
        options.profile.classify,
        student,
        truth.days.find(inOpening(term)) ?? "",
      ),
    );

  const enrollments = new Map<string, ReadonlySet<string>>();

  const enrollmentOf = (student: Truth.View, term: string | undefined) => {
    const key = `${student.id} ${term}`;
    const courses = enrollments.get(key) ?? chooseIn(student, term).courses;

    enrollments.set(key, courses);

    return courses;
  };

  // A student's courses on `day`: their Kurswahl, held from the term's opening weeks, and those
  // their classes join them to in the last store, so an event course created later still counts.
  const coursesOn = (student: Truth.View, day: string) =>
    new Set([
      ...enrollmentOf(student, termOf(day)),
      ...Students.joined(final, options.profile.classify, student, day),
    ]);

  const mondayOf = (week: string) => truth.days.find(inWeek(week)) ?? "";

  const lessonsIn = new Map<string, Array<Metrics.Lesson>>();

  for (const lesson of ours) {
    lessonsIn.set(weekOf(lesson.date), [...(lessonsIn.get(weekOf(lesson.date)) ?? []), lesson]);
  }

  // Students are scored only on weeks after both of their term's opening weeks.
  const held = (week: string) => {
    const openingWeeks = [...opening(termOfWeek(week))];

    return openingWeeks.length === 2 && openingWeeks.every((each) => each < week);
  };

  // A view's hidden days count on neither side, and a week of hidden days isn't measured.
  const shownIn = (view: Truth.View, week: string) =>
    truth.days.some((day) => inWeek(week)(day) && !view.hidden.has(day));

  // A teacher's or room's week with no upper-school entry and none of our lessons measures nothing.
  const viewWeeks = (type: Truth.ViewType) =>
    (type === "STUDENT" ? students : truth.views.filter((view) => view.type === type)).flatMap(
      (view) =>
        weeks
          .filter(
            (week) =>
              view.weeks.has(week) && shownIn(view, week) && (type !== "STUDENT" || held(week)),
          )
          .flatMap((week) => {
            const lessons = lessonsIn.get(week) ?? [];

            if (type === "STUDENT") {
              return [
                {
                  view,
                  week,
                  score: Students.week(
                    view,
                    inWeek(week),
                    lessons,
                    coursesOn(view, mondayOf(week)),
                  ),
                },
              ];
            }

            const mine = lessons.filter(
              (lesson) =>
                !view.hidden.has(lesson.date) &&
                (type === "TEACHER" ? lesson.teachers : lesson.rooms).includes(view.id),
            );

            const entries = view.entries.filter(
              (entry) => inWeek(week)(entry.date) && upperSchool(entry),
            );

            return entries.length === 0 && mine.length === 0
              ? []
              : [{ view, week, score: Metrics.scoreView(entries, mine) }];
          }),
    );

  const studentWeeks = viewWeeks("STUDENT");
  const heldTerms = [...new Set(weeks.filter(held).map(termOfWeek))];

  // Each held term's Kurswahl, against the opening weeks it was taken from. A student WebUntis
  // hid all of them from made no choice the truth can see.
  const kurswahl = heldTerms.flatMap((term) =>
    students
      .filter(
        (student) =>
          [...opening(term)].every((week) => student.weeks.has(week)) &&
          truth.days.some((day) => inOpening(term)(day) && !student.hidden.has(day)),
      )
      .map((student) => chooseIn(student, term).exact),
  );

  const ghostCourses = Students.ghosts(
    heldTerms.map((term) => ({
      lessons: ours.filter(
        ({ date }) => measured.has(weekOf(date)) && held(weekOf(date)) && termOf(date) === term,
      ),
      kurswahls: weeks
        .filter((week) => held(week) && termOfWeek(week) === term)
        .flatMap((week) => students.map((student) => coursesOn(student, mondayOf(week)))),
    })),
  );

  // Real courses come from the rosters of the opening weeks, so a student WebUntis hid a day of
  // them from would split their courses' rosters. Such a student counts in no roster that term.
  const identity = CourseIdentity.combine(
    [...openingWeeks].flatMap(([term, weeksOfTerm]) =>
      weeksOfTerm.size === 2 && [...weeksOfTerm].every((week) => measured.has(week))
        ? [
            CourseIdentity.measure({
              term: term ?? "",
              attendance: students
                .filter(
                  (student) =>
                    [...weeksOfTerm].every((week) => student.weeks.has(week)) &&
                    !truth.days.some((day) => inOpening(term)(day) && student.hidden.has(day)),
                )
                .map((student) => ({
                  student: student.name,
                  entries: student.entries.filter((entry) => inOpening(term)(entry.date)),
                })),
              index: openingStore(term).index,
              labels: corpus.cases.courses,
              weekOf,
            }),
          ]
        : [],
    ),
  );

  // Lessons the projection keeps out of the publish, such as those of a course without an
  // offering: the store holds them, and no student could ever see them.
  const { data } = Projection.project({
    profile: options.profile,
    previous: SchoolImport.empty,
    result: final,
    pending: [],
    today: yield* Effect.orDie(decodeDay(days[0] ?? "")),
  });

  const published = new Set(Object.values(data.lessons).flatMap((rows) => Object.keys(rows)));

  const unpublishedLessons = final.lessons.filter(
    ({ id, date }) => measuredDays.has(date) && !published.has(id),
  ).length;

  const changes = Metrics.scoreChanges(
    truth.changes.filter((entry) => measuredDays.has(entry.date) && upperSchool(entry)),
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

  const courseTeachers = new Map<string, ReadonlySet<number>>();

  for (const lesson of ours) {
    courseTeachers.set(
      lesson.courseId,
      new Set([...(courseTeachers.get(lesson.courseId) ?? []), ...lesson.teachers]),
    );
  }

  const subjectCodes = new Map(final.subjects.map((subject) => [subject.id, subject.shortName]));

  const courseSubjects = new Map(
    final.courses.map((course) => [
      course.id,
      course.subjectId === undefined ? undefined : subjectCodes.get(course.subjectId),
    ]),
  );

  // An exam counts for the students the truth has, on a day their timetable shows: its roster is
  // cut to them, and an exam with none of them left isn't measured.
  const studentViews = new Map(students.map((student) => [student.id, student]));

  const sees = (student: number, date: string) => {
    const view = studentViews.get(student);

    return view !== undefined && view.weeks.has(weekOf(date)) && !view.hidden.has(date);
  };

  const examsByTerm = [...new Set(days.map(termOf))].map((term) =>
    Metrics.scoreExams(
      truth.exams
        .filter((exam) => measuredDays.has(exam.date) && termOf(exam.date) === term)
        .map((exam) => ({
          ...exam,
          students: exam.students.filter((student) => sees(student, exam.date)),
        }))
        .filter((exam) => exam.students.length > 0),
      final.exams
        .filter((exam) => measuredDays.has(exam.date) && termOf(exam.date) === term)
        .map((exam) => ({ ...exam, examIds: examRefs.get(exam.id) ?? [] })),
      new Map(
        students.map((student) => [
          student.id,
          coursesOn(student, truth.days.find((day) => termOf(day) === term) ?? ""),
        ]),
      ),
      courseTeachers,
      courseSubjects,
      sees,
    ),
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
    kurswahl: Metrics.fraction(kurswahl.filter(Boolean).length, kurswahl.length),
    ghostCourses,
    courseIdentity: identity.counts,
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
    courseIdsKept: Metrics.sum(kept),
    lookahead: Metrics.sum(ahead),
    runs: { total: runs.length, failed: runs.filter((each) => each.failed).length },
    hiddenDays: truth.views.reduce(
      (count, view) => count + [...view.hidden].filter((day) => measuredDays.has(day)).length,
      0,
    ),
    invariants: {
      // A failing-reads rerun in which no read failed tested nothing, so it counts as failed.
      failedRuns: [
        base.failed,
        again.failed,
        reversed.failed,
        failing.failed || failing.log.injected.length === 0,
      ].filter(Boolean).length,
      danglingCourses: Metrics.dangling(final),
      unpublishedLessons,
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
    courseCases: identity.cases,
  } satisfies Report.Evaluation;
});
