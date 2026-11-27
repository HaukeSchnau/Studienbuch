/**
 * The distributions a synthetic school is generated from, measured on a corpus through the
 * harness's own truth: each student's, teacher's and room's view. A real course is a subject and
 * the students its entries are shown to in a term's opening weeks, as in `CourseIdentity`. Only
 * counts leave this module, and a bin of fewer than five people merges with a neighbour.
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import type { Corpus } from "../corpus/Corpus.ts";
import type { Metrics } from "../evaluation/Metrics.ts";
import { Truth } from "../evaluation/Truth.ts";
import { SchoolProfile } from "../profiles/SchoolProfile.ts";
import { Calibration } from "./Calibration.ts";

export * as Calibrate from "./Calibrate.ts";

/** One unit of a distribution: its value, and the people it holds. */
export interface Unit {
  readonly value: number;
  readonly people: Iterable<number>;
}

interface Draft {
  readonly from: number;
  readonly to: number;
  readonly count: number;
  readonly people: ReadonlySet<number>;
}

const join = (a: Draft, b: Draft): Draft => ({
  from: Math.min(a.from, b.from),
  to: Math.max(a.to, b.to),
  count: a.count + b.count,
  people: new Set([...a.people, ...b.people]),
});

/**
 * Bins of `width` over the units' values. A bin of fewer than five people joins the neighbour
 * that holds fewer, until none is left; units that together hold fewer give no bins at all.
 */
export const histogram = (units: Iterable<Unit>, width = 1): Calibration.Histogram => {
  const drafts: Array<Draft> = [];

  for (const unit of [...units].sort((a, b) => a.value - b.value)) {
    const from = Math.floor(unit.value / width) * width;
    const last = drafts.at(-1);
    const own: Draft = { from, to: from + width - 1, count: 1, people: new Set(unit.people) };

    if (last !== undefined && last.from === from) drafts.splice(-1, 1, join(last, own));
    else drafts.push(own);
  }

  for (;;) {
    const small = drafts.findIndex((draft) => draft.people.size < Calibration.fewestPeople);
    const before = drafts[small - 1];
    const after = drafts[small + 1];
    const draft = drafts[small];

    if (draft === undefined) break;

    if (before === undefined && after === undefined) return [];

    const left =
      after === undefined || (before !== undefined && before.people.size <= after.people.size);

    if (left && before !== undefined) drafts.splice(small - 1, 2, join(before, draft));
    else if (after !== undefined) drafts.splice(small, 2, join(draft, after));
  }

  return drafts.map(({ from, to, count, people }) => ({ from, to, count, people: people.size }));
};

/** A per-mille rate of each captured week. Weeks hold no people, so their bins never merge. */
const weekBins = (rates: ReadonlyArray<number>, width: number) => {
  const bins = new Map<number, number>();

  for (const rate of rates) {
    const from = Math.floor(rate / width) * width;

    bins.set(from, (bins.get(from) ?? 0) + 1);
  }

  return [...bins]
    .sort(([a], [b]) => a - b)
    .map(([from, count]) => ({ from, to: from + width - 1, count }));
};

const keyOf = (entry: Metrics.TruthEntry) => `${entry.date} ${entry.ids.join("+")}`;

const slotOf = (entry: Metrics.TruthEntry) => `${entry.date} ${entry.start}`;

const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

const mostCommon = <A>(values: Iterable<A>): A | undefined => {
  const counts = new Map<A, number>();

  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const shared = (a: ReadonlySet<number>, b: ReadonlySet<number>) =>
  [...a].filter((each) => b.has(each)).length;

/** A real course of one term: its subject, the classes its entries name, and who sees them. */
interface Course {
  readonly subject: string;
  readonly classes: ReadonlyArray<string>;
  readonly grade: number | undefined;
  readonly students: Set<number>;
  readonly entries: Array<Metrics.TruthEntry>;
}

/** Disjoint sets over indexes. */
const unionFind = (size: number) => {
  const parent = Array.from({ length: size }, (_, i) => i);

  const find = (i: number): number => {
    const up = parent[i] ?? i;

    if (up === i) return i;

    const root = find(up);

    parent[i] = root;

    return root;
  };

  return {
    find,
    union: (a: number, b: number) => {
      parent[find(b)] = find(a);
    },
  };
};

/**
 * Everything `measure` publishes, with the pitfalls as counted before any is left out. Only tests
 * read those raw counts; the file gets `measure`'s.
 */
export const observe = Effect.fn("Calibrate.observe")(function* (
  corpus: Corpus.Corpus,
  profile: SchoolProfile.SchoolProfile,
) {
  const truth = yield* Truth.build(corpus);

  const { client } = yield* RecordedWebUntis.make(corpus.reads, {
    asOf: corpus.manifest.capturedAt,
  });

  const years = yield* Effect.orDie(client.schoolyears.list);

  const gradeOfClass = (name: string) =>
    Option.getOrUndefined(SchoolProfile.gradeLevelRead(profile, profile.classify(name)));

  const lasting = (name: string) => profile.classify(name)._tag === "Lasting";

  // Each student's classes by school year, as the year's student directory lists them.
  const classesOf = new Map<string, ReadonlyArray<string>>();

  const yearOf = (day: string) =>
    years.find(
      (year) => year.dateRange.start.slice(0, 10) <= day && day <= year.dateRange.end.slice(0, 10),
    )?.id;

  for (const year of years) {
    const directory = yield* client.timetable
      .getFilter({
        resourceType: "STUDENT",
        start: year.dateRange.start.slice(0, 10),
        end: year.dateRange.end.slice(0, 10),
      })
      .pipe(Effect.option);

    for (const each of Option.match(directory, { onNone: () => [], onSome: (d) => d.students })) {
      classesOf.set(
        `${year.id} ${each.student.id}`,
        each.classes.map((entry) => entry.class.shortName),
      );
    }
  }

  const classesOn = (student: number, day: string) =>
    classesOf.get(`${yearOf(day)} ${student}`) ?? [];

  const gradeOn = (student: number, day: string) =>
    mostCommon(
      classesOn(student, day).flatMap((name) => {
        const grade = gradeOfClass(name);

        return grade === undefined ? [] : [grade];
      }),
    );

  const weekOf = (day: string) => truth.weekOf.get(day) ?? "";
  const weeks = [...new Set(truth.days.map(weekOf))].sort();

  const inTerm = (day: string) => (term: { readonly start: string; readonly end: string }) =>
    term.start <= day && day <= term.end;

  const termOf = (day: string) =>
    (corpus.cases.terms.find(inTerm(day)) ?? truth.halves.find(inTerm(day)))?.id;

  const fullWeeks = weeks.filter(
    (week) => truth.days.filter((day) => weekOf(day) === week).length === 5,
  );

  const students = truth.views.filter((view) => view.type === "STUDENT");

  const terms = sorted(
    truth.days.flatMap((day) => Option.toArray(Option.fromNullishOr(termOf(day)))),
  );

  const cohortUnits = new Map<
    number,
    {
      classCourses: Array<Unit>;
      kopplungen: Array<Unit>;
      kopplungShare: Array<Unit>;
      courseSize: Array<Unit>;
      meetings: Array<Unit>;
    }
  >();

  const unitsOf = (grade: number) => {
    const known = cohortUnits.get(grade);

    if (known !== undefined) return known;

    const fresh = {
      classCourses: [],
      kopplungen: [],
      kopplungShare: [],
      courseSize: [],
      meetings: [],
    };

    cohortUnits.set(grade, fresh);

    return fresh;
  };

  const teachersPerCourse: Array<Unit> = [];
  const roomsPerCourse: Array<Unit> = [];
  const examsPerCourse: Array<Unit> = [];

  const pitfalls = {
    sameCodeApart: { count: 0, people: new Set<number>() },
    sameCodeParallel: { count: 0, people: new Set<number>() },
    sharedEntries: { count: 0, people: new Set<number>() },
    rosterChanges: { count: 0, people: new Set<number>() },
    lateJoins: { count: 0, people: new Set<number>() },
  };

  let measuredTerms = 0;

  for (const term of terms) {
    const termWeeks = fullWeeks.filter((week) =>
      truth.days.filter((day) => weekOf(day) === week).every((day) => termOf(day) === term),
    );

    const opening = new Set(termWeeks.slice(0, 2));
    const later = new Set(termWeeks.slice(2));

    if (opening.size < 2) continue;

    measuredTerms += 1;

    const openingDays = truth.days.filter((day) => opening.has(weekOf(day)));

    const attending = students.filter(
      (view) =>
        [...opening].every((week) => view.weeks.has(week)) &&
        !openingDays.some((day) => view.hidden.has(day)),
    );

    const shown = new Map<string, { entry: Metrics.TruthEntry; students: Set<number> }>();

    for (const view of attending) {
      for (const entry of view.entries) {
        if (!opening.has(weekOf(entry.date)) || entry.status === "Added") continue;

        if (entry.subjects.length === 0) continue;

        const known = shown.get(keyOf(entry)) ?? { entry, students: new Set<number>() };

        known.students.add(view.id);
        shown.set(keyOf(entry), known);
      }
    }

    // Rosters as `CourseIdentity` finds them: a subject and the students an entry is shown to.
    const rosters = new Map<string, Course>();

    for (const { entry, students: seen } of shown.values()) {
      const subject = entry.subjects.join("+");
      const key = `${subject}\n${[...seen].sort((a, b) => a - b).join(" ")}`;

      const known = rosters.get(key) ?? {
        subject,
        classes: [],
        grade: mostCommon(
          [...seen].flatMap((id) => Option.toArray(Option.fromNullishOr(gradeOn(id, entry.date)))),
        ),
        students: seen,
        entries: [],
      };

      known.entries.push(entry);
      rosters.set(key, { ...known, classes: sorted([...known.classes, ...entry.classes]) });
    }

    // A subject's rosters within the same classes are one course whose roster changed when they
    // share nearly everyone, a group shown entries of a larger group when the larger holds most of
    // it, and two groups otherwise.
    const all = [...rosters.values()];
    const merged = unionFind(all.length);
    const widerGroup = new Set<number>();
    const families = new Map<string, Array<number>>();

    for (const [i, roster] of all.entries()) {
      const key = `${roster.subject}\n${roster.classes.join(" ")}`;

      families.set(key, [...(families.get(key) ?? []), i]);
    }

    // Each family counts once per pitfall, however many of its rosters show it.
    for (const members of families.values()) {
      const bySize = members.toSorted(
        (a, b) => (all[b]?.students.size ?? 0) - (all[a]?.students.size ?? 0),
      );

      const wider = new Set<number>();

      for (const [n, i] of bySize.entries()) {
        for (const j of bySize.slice(n + 1)) {
          const large = all[i];
          const small = all[j];

          if (large === undefined || small === undefined || wider.has(j)) continue;

          if (shared(large.students, small.students) * 2 <= small.students.size) continue;

          if (large.students.size * 2 >= small.students.size * 3) {
            wider.add(i);
          } else {
            merged.union(i, j);

            for (const id of [...large.students, ...small.students]) {
              if (!(large.students.has(id) && small.students.has(id))) {
                pitfalls.rosterChanges.people.add(id);
              }
            }
          }
        }
      }

      for (const i of wider) {
        widerGroup.add(i);

        for (const id of all[i]?.students ?? []) pitfalls.sharedEntries.people.add(id);
      }

      if (wider.size > 0) pitfalls.sharedEntries.count += 1;

      // What is left are the family's groups: one roster each, or several joined by a change.
      const kept = new Map<number, Array<Course>>();

      for (const i of members) {
        const roster = all[i];

        if (roster === undefined || wider.has(i)) continue;

        kept.set(merged.find(i), [...(kept.get(merged.find(i)) ?? []), roster]);
      }

      const changed = [...kept.values()].filter((rosters) => rosters.length > 1).length;

      pitfalls.rosterChanges.count += changed;

      if (kept.size < 2) continue;

      const slotsOf = [...kept.values()].map(
        (rosters) => new Set(rosters.flatMap((roster) => roster.entries.map(slotOf))),
      );

      const parallel = slotsOf.some((a, i) =>
        slotsOf.some((b, j) => j > i && [...a].some((slot) => b.has(slot))),
      );

      const pitfall = parallel ? pitfalls.sameCodeParallel : pitfalls.sameCodeApart;

      pitfall.count += kept.size;

      for (const rosters of kept.values()) {
        for (const roster of rosters) for (const id of roster.students) pitfall.people.add(id);
      }
    }

    const groups = new Map<number, Course>();

    for (const [i, roster] of all.entries()) {
      if (widerGroup.has(i)) continue;

      const root = merged.find(i);
      const known = groups.get(root);

      groups.set(
        root,
        known === undefined
          ? { ...roster, students: new Set(roster.students), entries: [...roster.entries] }
          : {
              ...known,
              students: new Set([...known.students, ...roster.students]),
              entries: [...known.entries, ...roster.entries],
            },
      );
    }

    const courses = [...groups.values()];

    for (const course of courses) {
      const regular = course.entries.filter((entry) => entry.status === "Regular");
      const planned = regular.length > 0 ? regular : course.entries;
      const teachers = new Set(planned.flatMap((entry) => entry.teachers));
      const rooms = new Set(planned.flatMap((entry) => entry.rooms));

      teachersPerCourse.push({ value: teachers.size, people: teachers });
      roomsPerCourse.push({ value: rooms.size, people: course.students });

      const exams = truth.exams.filter(
        (exam) =>
          termOf(exam.date) === term &&
          exam.subject === course.subject &&
          shared(new Set(exam.students), course.students) * 2 > exam.students.length,
      );

      examsPerCourse.push({ value: exams.length, people: course.students });

      if (course.grade === undefined) continue;

      const units = unitsOf(course.grade);

      units.courseSize.push({ value: course.students.size, people: course.students });
      units.meetings.push({ value: course.entries.length, people: course.students });
    }

    // Courses of one cohort that share at least half of their slots meet as one Kopplung. A
    // course of one lasting class is that class's own.
    for (const grade of profile.gradeLevels) {
      const cohort = courses.filter((course) => course.grade === grade);

      const ofClass = (course: Course) =>
        course.classes.length === 1 && course.classes.every(lasting);

      const coupled = cohort.filter((course) => !ofClass(course));
      const sets = coupled.map((course) => new Set(course.entries.map(slotOf)));
      const together = unionFind(coupled.length);

      for (const [i, a] of sets.entries()) {
        for (const [j, b] of sets.entries()) {
          if (j <= i) continue;

          const both = [...a].filter((slot) => b.has(slot)).length;

          if (both * 2 >= Math.min(a.size, b.size)) together.union(i, j);
        }
      }

      const kopplungen = new Map<number, Array<Course>>();

      for (const [i, course] of coupled.entries()) {
        kopplungen.set(together.find(i), [...(kopplungen.get(together.find(i)) ?? []), course]);
      }

      const cohortStudents = new Set(
        attending
          .filter((view) => gradeOn(view.id, openingDays[0] ?? "") === grade)
          .map((view) => view.id),
      );

      const units = unitsOf(grade);

      for (const members of kopplungen.values()) {
        const held = new Set(members.flatMap((course) => [...course.students]));

        units.kopplungen.push({ value: members.length, people: held });
        units.kopplungShare.push({
          value: Math.round((held.size * 100) / Math.max(cohortStudents.size, 1)),
          people: held,
        });
      }

      const classNames = sorted(cohort.filter(ofClass).flatMap((course) => course.classes));

      for (const name of classNames) {
        const members = attending.filter((view) =>
          classesOn(view.id, openingDays[0] ?? "").includes(name),
        );

        units.classCourses.push({
          value: cohort.filter((course) => ofClass(course) && course.classes.includes(name)).length,
          people: members.map((view) => view.id),
        });
      }
    }

    // A student joins a course after the opening weeks when a subject they didn't have then meets
    // in most of their later weeks. Two or more dropped, or more than two new, is a change of
    // class or of timetable instead.
    const weeksOfSubjects = (view: Truth.View, inWeeks: ReadonlySet<string>) => {
      const found = new Map<string, Set<string>>();

      for (const entry of view.entries) {
        if (!inWeeks.has(weekOf(entry.date)) || entry.status === "Added") continue;

        const code = entry.subjects.join("+");

        found.set(code, new Set([...(found.get(code) ?? []), weekOf(entry.date)]));
      }

      return found;
    };

    for (const view of attending) {
      const shownLater = new Set(
        [...later].filter(
          (week) =>
            view.weeks.has(week) &&
            !truth.days.some((day) => weekOf(day) === week && view.hidden.has(day)),
        ),
      );

      if (shownLater.size < 2) continue;

      const before = weeksOfSubjects(view, opening);
      const after = weeksOfSubjects(view, shownLater);
      const dropped = [...before.keys()].filter((code) => !after.has(code));

      const joined = [...after].filter(
        ([code, inWeeks]) => !before.has(code) && inWeeks.size * 2 >= shownLater.size,
      );

      if (dropped.length <= 1 && joined.length >= 1 && joined.length <= 2) {
        pitfalls.lateJoins.count += joined.length;
        pitfalls.lateJoins.people.add(view.id);
      }
    }
  }

  // The cohorts and the school's resources as of the latest term measured.
  const latestTerm = terms.at(-1);
  const latestDays = truth.days.filter((day) => termOf(day) === latestTerm);
  const firstDay = latestDays[0] ?? "";
  const latest = new Set(latestDays);

  const upperEntries = students.flatMap((view) =>
    view.entries.filter((entry) => latest.has(entry.date)),
  );

  const upperTeachers = new Set(upperEntries.flatMap((entry) => entry.teachers));
  const upperRooms = new Set(upperEntries.flatMap((entry) => entry.rooms));

  const taughtByUpper = truth.views
    .filter((view) => view.type === "TEACHER" && upperTeachers.has(view.id))
    .flatMap((view) => view.entries.filter((entry) => latest.has(entry.date)));

  const lower = taughtByUpper.filter(
    (entry) =>
      entry.classes.length > 0 && entry.classes.every((name) => gradeOfClass(name) === undefined),
  );

  const cohorts = profile.gradeLevels.flatMap((grade) => {
    const members = students.filter((view) => gradeOn(view.id, firstDay) === grade);
    const units = cohortUnits.get(grade);

    if (members.length === 0 || units === undefined) return [];

    const classes = sorted(
      members.flatMap((view) => classesOn(view.id, firstDay).filter(lasting)),
    ).length;

    return [
      {
        grade,
        people: members.length >= Calibration.fewestPeople ? members.length : 0,
        classes,
        classCourses: histogram(units.classCourses),
        kopplungen: histogram(units.kopplungen),
        kopplungShare: histogram(units.kopplungShare, 10),
        courseSize: histogram(units.courseSize),
        meetings: histogram(units.meetings),
      },
    ];
  });

  // What changed in each captured week, of the upper school's entries.
  const changes = fullWeeks.flatMap((week) => {
    const entries = [
      ...new Map(
        students.flatMap((view) =>
          view.entries
            .filter((entry) => weekOf(entry.date) === week)
            .map((entry) => [keyOf(entry), entry] as const),
        ),
      ).values(),
    ];

    if (entries.length === 0) return [];

    const perMille = (count: number) => Math.round((count * 1000) / entries.length);

    const substituted = entries.filter(
      (entry) => entry.status === "Changed" && entry.previousTeachers.length > 0,
    );

    return [
      {
        cancelled: perMille(entries.filter((entry) => entry.status === "Cancelled").length),
        substituted: perMille(substituted.length),
        roomChanged: perMille(
          entries.filter(
            (entry) =>
              entry.status === "Changed" &&
              entry.previousTeachers.length === 0 &&
              entry.previousRooms.length > 0,
          ).length,
        ),
        added: perMille(entries.filter((entry) => entry.status === "Added").length),
      },
    ];
  });

  const hidden = students.flatMap((view): ReadonlyArray<Unit> => {
    const days = truth.days.filter((day) => view.weeks.has(weekOf(day)));
    const count = days.filter((day) => view.hidden.has(day)).length;

    return count === 0
      ? []
      : [{ value: Math.round((count * 100) / days.length), people: [view.id] }];
  });

  return {
    pitfalls: Object.fromEntries(
      Object.entries(pitfalls).map(([name, { count, people }]) => [
        name,
        { count, people: people.size },
      ]),
    ),
    distributions: {
      terms: measuredTerms,
      cohorts,
      teachers: {
        people: upperTeachers.size >= Calibration.fewestPeople ? upperTeachers.size : 0,
        perCourse: histogram(teachersPerCourse),
      },
      rooms: { count: upperRooms.size, perCourse: histogram(roomsPerCourse) },
      lowerSchool: {
        classes: new Set(lower.flatMap((entry) => entry.classes)).size,
        share: Math.round((lower.length * 100) / Math.max(taughtByUpper.length, 1)),
      },
      changes: {
        cancelled: weekBins(
          changes.map((each) => each.cancelled),
          20,
        ),
        substituted: weekBins(
          changes.map((each) => each.substituted),
          10,
        ),
        roomChanged: weekBins(
          changes.map((each) => each.roomChanged),
          5,
        ),
        added: weekBins(
          changes.map((each) => each.added),
          5,
        ),
      },
      exams: histogram(examsPerCourse),
      hidden: histogram(hidden, 10),
    },
  };
});

/** The calibration of a corpus, held to the file's format: no pitfall of fewer than five people. */
export const measure = Effect.fn("Calibrate.measure")(function* (
  corpus: Corpus.Corpus,
  profile: SchoolProfile.SchoolProfile,
) {
  const { pitfalls, distributions } = yield* observe(corpus, profile);

  return yield* Effect.orDie(
    Calibration.decodeValue({
      ...distributions,
      pitfalls: Object.fromEntries(
        Object.entries(pitfalls).flatMap(([name, { count, people }]) =>
          people >= Calibration.fewestPeople ? [[name, { count, people }]] : [],
        ),
      ),
    }),
  );
});
