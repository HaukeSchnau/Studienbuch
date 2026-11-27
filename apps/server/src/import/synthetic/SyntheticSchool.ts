/**
 * An upper school generated from a calibration and a seed, the same for the same pair (M2.11), with
 * invented names and the pitfalls that broke the import planted. Each student's view shows their
 * true courses, and labelled cases tell apart what rosters can't, so the harness's truth is ours.
 */
import { CivilTime, School as CoreSchool } from "@stu/core";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Random from "effect/Random";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import type { Corpus } from "../corpus/Corpus.ts";
import { IgsLilienthal } from "../profiles/IgsLilienthal.ts";
import type { SchoolProfile } from "../profiles/SchoolProfile.ts";
import type { Calibration } from "./Calibration.ts";
import { WebUntisBodies } from "./WebUntisBodies.ts";

export * as SyntheticSchool from "./SyntheticSchool.ts";

type Resource = WebUntisBodies.Resource;

const { resource, display, position, positions } = WebUntisBodies;

type Weekday = 1 | 2 | 3 | 4 | 5;

const weekdays: ReadonlyArray<Weekday> = [1, 2, 3, 4, 5];

type Label = "A" | "B";

/** Where a course meets each week, or in A or B weeks only. */
export interface Meeting {
  readonly weekday: Weekday;
  readonly block: number;
  readonly only: Label | undefined;
}

/** A true course: one subject code taught to one roster, which may change on a date. */
export interface Course {
  readonly id: string;
  readonly grade: number;
  readonly subject: Resource;
  /** The classes its entries name, all of grade 11's for a Kopplung there. */
  readonly classes: ReadonlyArray<Resource>;
  readonly teachers: ReadonlyArray<Resource>;
  readonly room: Resource | undefined;
  readonly meetings: ReadonlyArray<Meeting>;
  /** A lower-school lesson, whose students the corpus doesn't read. */
  readonly lower: boolean;
}

/** A student in a course from `from` to `until`, both inclusive. */
export interface Membership {
  readonly course: string;
  readonly student: number;
  readonly from: string;
  readonly until: string;
}

export interface Student extends Resource {
  readonly grade: number;
  readonly schoolClass: Resource;
  /** The first day WebUntis hides from the capture's account, if any. */
  readonly hiddenFrom: string | undefined;
}

/** The school the generator built: the corpus, and the truth it encodes. */
export interface School {
  readonly corpus: Corpus.Corpus;
  readonly courses: ReadonlyArray<Course>;
  readonly memberships: ReadonlyArray<Membership>;
  readonly students: ReadonlyArray<Student>;
  /** Students who switch or join a course, and from which day. */
  readonly moves: ReadonlyArray<Move>;
  /** The true course of each entry, by its date and WebUntis ids such as `2026-09-07 1000+1003`. */
  readonly courseOf: ReadonlyMap<string, string>;
}

const blocks: WebUntisBodies.Blocks = [
  ["08:00", "09:20"],
  ["09:45", "11:05"],
  ["11:30", "12:50"],
  ["13:50", "15:10"],
  ["15:15", "16:35"],
];

/** A cohort's lunchtime slot, where an entry of the whole cohort meets. */
const lunch = 6;

const timesOf = (block: number) =>
  block === lunch ? (["13:20", "13:50"] as const) : (blocks[block - 1] ?? ["08:00", "09:20"]);

// Invented names: plants as surnames, and first names that no real class list needs.
const surnames = [
  "Ahorn",
  "Birke",
  "Buche",
  "Eibe",
  "Eiche",
  "Erle",
  "Esche",
  "Espe",
  "Fichte",
  "Hasel",
  "Holunder",
  "Kiefer",
  "Lärche",
  "Linde",
  "Mistel",
  "Pappel",
  "Platane",
  "Quitte",
  "Robinie",
  "Schlehe",
  "Tanne",
  "Ulme",
  "Weide",
  "Zeder",
  "Zirbe",
  "Akazie",
  "Flieder",
  "Ginster",
  "Heide",
  "Jasmin",
  "Kastanie",
  "Lavendel",
  "Magnolie",
  "Mohn",
  "Nelke",
  "Olive",
  "Primel",
  "Raute",
  "Salbei",
  "Thymian",
];

const firstNames = [
  "Alva",
  "Bent",
  "Cora",
  "Dano",
  "Elin",
  "Fiete",
  "Greta",
  "Hanno",
  "Ilka",
  "Jorin",
  "Kaja",
  "Lasse",
  "Mika",
  "Nele",
  "Ole",
  "Pia",
  "Quirin",
  "Rieke",
  "Sönke",
  "Tjark",
  "Ulla",
  "Veit",
  "Wiebke",
  "Xandra",
  "Yuna",
  "Zeno",
];

interface Subject {
  readonly code: string;
  readonly name: string;
}

/** Subjects a grade-11 class has alone. */
const classSubjects: ReadonlyArray<Subject> = [
  { code: "DE", name: "Deutsch" },
  { code: "MA", name: "Mathematik" },
  { code: "EN", name: "Englisch" },
  { code: "BI", name: "Biologie" },
  { code: "CH", name: "Chemie" },
  { code: "PH", name: "Physik" },
  { code: "GE", name: "Geschichte" },
  { code: "EK", name: "Erdkunde" },
  { code: "PO", name: "Politik" },
  { code: "SP", name: "Sport" },
  { code: "TU", name: "Tutorium" },
];

/** Subjects of the Kopplungen; a course's code adds its group's number. */
const kopplungSubjects: ReadonlyArray<Subject> = [
  { code: "de", name: "Deutsch" },
  { code: "ma", name: "Mathematik" },
  { code: "en", name: "Englisch" },
  { code: "bi", name: "Biologie" },
  { code: "ch", name: "Chemie" },
  { code: "ph", name: "Physik" },
  { code: "ge", name: "Geschichte" },
  { code: "ek", name: "Erdkunde" },
  { code: "po", name: "Politik" },
  { code: "ku", name: "Kunst" },
  { code: "mu", name: "Musik" },
  { code: "ds", name: "Darstellendes Spiel" },
  { code: "re", name: "Religion" },
  { code: "wn", name: "Werte und Normen" },
  { code: "fr", name: "Französisch" },
  { code: "es", name: "Spanisch" },
  { code: "la", name: "Latein" },
  { code: "if", name: "Informatik" },
  { code: "sp", name: "Sport" },
];

const lowerSubjects: ReadonlyArray<Subject> = [
  { code: "D", name: "Deutsch" },
  { code: "M", name: "Mathematik" },
  { code: "E", name: "Englisch" },
  { code: "NW", name: "Naturwissenschaften" },
  { code: "GL", name: "Gesellschaftslehre" },
  { code: "Spo", name: "Sport" },
];

const year: WebUntisBodies.Year = {
  id: 26,
  name: "2026/2027",
  start: "2026-08-13",
  end: "2027-07-07",
};

const holidays = [{ id: 1, name: "Herbstferien", start: "2026-10-12", end: "2026-10-23" }];

/** The capture: the first school day to the week after the autumn break. */
export const range = { start: "2026-08-13", end: "2026-11-06" };

const capturedAt = DateTime.makeUnsafe("2026-11-06T18:00:00Z");

interface Day {
  readonly date: string;
  readonly weekday: Weekday;
  readonly week: string;
}

/** Monday to Friday of the capture, holidays included. */
const calendar: ReadonlyArray<Day> = Option.match(CivilTime.mondayOf("2026-W33"), {
  onNone: () => [],
  onSome: (monday) =>
    Array.from({ length: 7 * 13 }, (_, i) => CivilTime.addDays(monday, i)).flatMap((date) => {
      const text = CivilTime.format(date);
      const weekday = weekdays.find((each) => each === CivilTime.dayOfWeek(date));

      return weekday !== undefined && text >= range.start && text <= range.end
        ? [{ date: text, weekday, week: CivilTime.isoWeek(date) }]
        : [];
    }),
});

const closed = (date: string) =>
  holidays.some((holiday) => holiday.start <= date && date <= holiday.end);

const schoolDays = calendar.filter((day) => !closed(day.date));

/** Each school week's label, alternating from A over the weeks with school. */
const labels: ReadonlyMap<string, Label> = new Map(
  [...new Set(schoolDays.map((day) => day.week))].map((week, i) => [week, i % 2 === 0 ? "A" : "B"]),
);

const fullWeeks = [...labels.keys()].filter(
  (week) => schoolDays.filter((day) => day.week === week).length === 5,
);

/** The two weeks the harness takes each student's Kurswahl from. */
const opening = new Set(fullWeeks.slice(0, 2));

const slotKeys = (meeting: Meeting) =>
  (meeting.only === undefined ? (["A", "B"] as const) : [meeting.only]).map(
    (label) => `${meeting.weekday} ${meeting.block} ${label}`,
  );

/** A drawn value of a distribution: a bin by its count, then a value in it. */
const draw = Effect.fn("SyntheticSchool.draw")(function* (
  histogram: ReadonlyArray<{ readonly from: number; readonly to: number; readonly count: number }>,
  fallback: number,
) {
  const total = histogram.reduce((sum, bin) => sum + bin.count, 0);

  if (total === 0) return fallback;

  let pick = yield* Random.nextIntBetween(0, total, { halfOpen: true });

  for (const bin of histogram) {
    if (pick < bin.count) return yield* Random.nextIntBetween(bin.from, bin.to);

    pick -= bin.count;
  }

  return fallback;
});

const perTerm = (count: number, terms: number) => Math.round(count / Math.max(terms, 1));

interface Draft {
  id: string;
  grade: number;
  subject: Resource;
  classes: ReadonlyArray<Resource>;
  meetings: ReadonlyArray<Meeting>;
  roster: Array<number>;
  kopplung: number | undefined;
  /** A teacher it should have, to share one with another course. */
  teacherOf: string | undefined;
  teachers: Array<Resource>;
  room: Resource | undefined;
  lower: boolean;
}

export interface Move {
  readonly student: number;
  /** The course the student leaves, none when they join one. */
  readonly from: string | undefined;
  readonly to: string;
  readonly date: string;
}

export const generate = Effect.fn("SyntheticSchool.generate")(function* (
  calibration: Calibration.Calibration,
  seed: number,
) {
  return yield* build(calibration, seed).pipe(Random.withSeed(seed));
});

const build = Effect.fnUntraced(function* (calibration: Calibration.Calibration, seed: number) {
  const { terms } = calibration;
  let nextId = 1;
  const id = () => nextId++;

  const subjects = new Map<string, Resource>();

  const subjectOf = ({ code, name }: Subject, suffix = "") => {
    const key = `${code}${suffix}`;
    const known = subjects.get(key);

    if (known !== undefined) return known;

    const made = resource(50_000 + id(), key, suffix === "" ? name : `${name} ${suffix}`);

    subjects.set(key, made);

    return made;
  };

  const teacherCount = Math.max(calibration.teachers.people, 10);

  const teachers = Array.from({ length: teacherCount }, (_, i) => {
    const surname = surnames[i % surnames.length] ?? "Ahorn";
    const round = Math.floor(i / surnames.length);
    const short = `${surname.slice(0, 3).toUpperCase()}${round === 0 ? "" : round + 1}`;

    return resource(20_000 + i, short, round === 0 ? surname : `${surname} ${round + 1}`);
  });

  const rooms = Array.from({ length: Math.max(calibration.rooms.count, 10) }, (_, i) =>
    resource(30_000 + i, `R${Math.floor(i / 20) + 1}.${String((i % 20) + 1).padStart(2, "0")}`),
  );

  const classes: Array<Resource> = [];
  const students: Array<Student> = [];
  const drafts: Array<Draft> = [];
  const studentsOfGrade = new Map<number, Array<number>>();
  const kopplungen: Array<{ grade: number; courses: Array<Draft> }> = [];

  /** Free half-slots of each class resource, by key. */
  const busy = new Map<number, Set<string>>();

  const free = (units: ReadonlyArray<Resource>, meeting: Meeting) =>
    units.every((unit) =>
      slotKeys(meeting).every((key) => !(busy.get(unit.id)?.has(key) ?? false)),
    );

  const occupy = (units: ReadonlyArray<Resource>, meetings: ReadonlyArray<Meeting>) => {
    for (const unit of units) {
      const keys = busy.get(unit.id) ?? new Set<string>();

      for (const meeting of meetings) for (const key of slotKeys(meeting)) keys.add(key);
      busy.set(unit.id, keys);
    }
  };

  /** `count` entries a fortnight in slots free for every unit: weekly ones, then one A or B. */
  const schedule = Effect.fn("SyntheticSchool.schedule")(function* (
    units: ReadonlyArray<Resource>,
    count: number,
  ) {
    const slots = yield* Random.shuffle(
      weekdays.flatMap((weekday) => [1, 2, 3, 4].map((block) => ({ weekday, block }))),
    );

    const meetings: Array<Meeting> = [];

    for (let i = 0; i < Math.floor(count / 2); i++) {
      const slot = slots.find(
        (each) =>
          free(units, { ...each, only: undefined }) &&
          !meetings.some((m) => m.weekday === each.weekday && m.block === each.block),
      );

      if (slot !== undefined) meetings.push({ ...slot, only: undefined });
    }

    if (count % 2 === 1) {
      const only: Label = (yield* Random.nextBoolean) ? "A" : "B";

      const slot = slots.find(
        (each) =>
          free(units, { ...each, only }) &&
          !meetings.some((m) => m.weekday === each.weekday && m.block === each.block),
      );

      if (slot !== undefined) meetings.push({ ...slot, only });
    }

    occupy(units, meetings);

    return meetings;
  });

  for (const cohort of calibration.cohorts) {
    const grade = cohort.grade;

    const ofCohort =
      cohort.classes > 0
        ? Array.from({ length: cohort.classes }, (_, i) =>
            resource(40_000 + id(), `${grade}.${i + 1}`),
          )
        : [resource(40_000 + id(), `${grade}`, `Jahrgang ${grade}`)];

    classes.push(...ofCohort);

    const members: Array<number> = [];

    for (let i = 0; i < cohort.people; i++) {
      const n = students.length;
      const first = firstNames[n % firstNames.length] ?? "Alva";
      const last = surnames[Math.floor(n / firstNames.length) % surnames.length] ?? "Ahorn";
      const schoolClass = ofCohort[i % ofCohort.length] ?? ofCohort[0];

      if (schoolClass === undefined) continue;

      const student: Student = {
        ...resource(10_000 + n, `${first}${last}`, `${first} ${last}`),
        grade,
        schoolClass,
        hiddenFrom: undefined,
      };

      students.push(student);
      members.push(student.id);
    }

    studentsOfGrade.set(grade, members);

    // A lasting class's own courses: the whole class, one subject each.
    if (cohort.classes > 0) {
      for (const schoolClass of ofCohort) {
        const count = yield* draw(cohort.classCourses, 6);
        const own = (yield* Random.shuffle(classSubjects)).slice(0, count);
        const roster = students.flatMap((s) => (s.schoolClass === schoolClass ? [s.id] : []));

        for (const kind of own) {
          const meetings = yield* schedule([schoolClass], yield* draw(cohort.meetings, 3));

          if (meetings.length === 0) continue;

          drafts.push({
            id: `${schoolClass.shortName} ${kind.code}`,
            grade,
            subject: subjectOf(kind),
            classes: [schoolClass],
            meetings,
            roster,
            kopplung: undefined,
            teacherOf: undefined,
            teachers: [],
            room: undefined,
            lower: false,
          });
        }
      }
    }

    // Kopplungen: courses meeting at once, among which their students split.
    const groupNumbers = new Map<string, number>();

    const count = perTerm(
      cohort.kopplungen.reduce((sum, bin) => sum + bin.count, 0),
      terms,
    );

    for (let k = 0; k < count; k++) {
      const size = Math.max(1, yield* draw(cohort.kopplungen, 3));
      const meetings = yield* schedule(ofCohort, yield* draw(cohort.meetings, 3));

      if (meetings.length === 0) continue;

      const share = Math.min(100, yield* draw(cohort.kopplungShare, 100));

      const held = (yield* Random.shuffle(members)).slice(
        0,
        Math.round((members.length * share) / 100),
      );

      const weights: Array<number> = [];

      for (let i = 0; i < size; i++) weights.push(Math.max(1, yield* draw(cohort.courseSize, 12)));

      const total = weights.reduce((sum, w) => sum + w, 0);
      const kinds = yield* Random.shuffle(kopplungSubjects);
      const courses: Array<Draft> = [];
      let start = 0;

      for (const [i, weight] of weights.entries()) {
        const end =
          i === weights.length - 1
            ? held.length
            : start + Math.round((held.length * weight) / total);

        const roster = held.slice(start, end);
        const kind = kinds[i % kinds.length] ?? kopplungSubjects[0];

        start = end;

        if (roster.length === 0 || kind === undefined) continue;

        const number = (groupNumbers.get(kind.code) ?? 0) + 1;

        const code =
          meetings.length >= 3 && cohort.classes === 0 ? kind.code.toUpperCase() : kind.code;

        groupNumbers.set(kind.code, number);

        courses.push({
          id: `${grade} ${code}${number}`,
          grade,
          subject: subjectOf({ code, name: kind.name }, String(number)),
          classes: ofCohort,
          meetings,
          roster,
          kopplung: kopplungen.length,
          teacherOf: undefined,
          teachers: [],
          room: undefined,
          lower: false,
        });
      }

      drafts.push(...courses);
      kopplungen.push({ grade, courses });
    }
  }

  const pitfalls = calibration.pitfalls;
  const used = new Set<string>();
  const pickCourse = (list: ReadonlyArray<Draft>) => list.find((each) => !used.has(each.id));

  // Groups of one code in different Kopplungen, taught by one teacher: never at the same time.
  for (let n = 0; n < perTerm(pitfalls.sameCodeApart?.count ?? 0, terms) / 2; n++) {
    const pairs = kopplungen.flatMap((a, i) =>
      kopplungen.slice(i + 1).flatMap((b) => {
        const first = pickCourse(a.courses);
        const second = pickCourse(b.courses.filter((each) => each !== first));

        return a.grade === b.grade && first !== undefined && second !== undefined
          ? [[first, second] as const]
          : [];
      }),
    );

    const [pair] = yield* Random.shuffle(pairs);

    if (pair === undefined) break;

    const [first, second] = pair;

    second.subject = first.subject;
    second.teacherOf = first.id;
    used.add(first.id).add(second.id);
  }

  // Groups of one code in one Kopplung, under different teachers.
  for (let n = 0; n < perTerm(pitfalls.sameCodeParallel?.count ?? 0, terms) / 2; n++) {
    const [kopplung] = yield* Random.shuffle(
      kopplungen.filter((each) => each.courses.filter((c) => !used.has(c.id)).length >= 2),
    );

    const [first, second] = kopplung?.courses.filter((c) => !used.has(c.id)) ?? [];

    if (first === undefined || second === undefined) break;

    second.subject = first.subject;
    used.add(first.id).add(second.id);
  }

  // A course of which the whole cohort sees an entry every week at lunchtime, under its code.
  const shared: Array<Draft> = [];

  for (let n = 0; n < perTerm(pitfalls.sharedEntries?.count ?? 0, terms); n++) {
    const [group] = yield* Random.shuffle(
      drafts.filter((d) => d.kopplung !== undefined && !used.has(d.id)),
    );

    if (group === undefined) break;

    const weekday = weekdays.find(
      (day) =>
        !shared.some(
          (each) => each.grade === group.grade && each.meetings.some((m) => m.weekday === day),
        ),
    );

    if (weekday === undefined) break;

    used.add(group.id);
    shared.push({
      ...group,
      id: `${group.id} shared`,
      meetings: [{ weekday, block: lunch, only: undefined }],
      roster: studentsOfGrade.get(group.grade) ?? [],
      kopplung: undefined,
      teacherOf: group.id,
    });
  }

  drafts.push(...shared);

  // Students whose timetable WebUntis hides from some day on.
  const hiddenBins = calibration.hidden.map(({ from, to, people }) => ({
    from,
    to,
    count: people,
  }));

  const hiddenCount = calibration.hidden.reduce((sum, bin) => sum + bin.people, 0);

  const hiddenOnes = new Set(
    (yield* Random.shuffle(students.map((s) => s.id))).slice(0, hiddenCount),
  );

  const hiddenFrom = new Map<number, string>();

  for (const student of hiddenOnes) {
    const percent = Math.min(95, yield* draw(hiddenBins, 50));
    const day = calendar[Math.floor((calendar.length * (100 - percent)) / 100)];

    if (day !== undefined) hiddenFrom.set(student, day.date);
  }

  // Roster changes in the second opening week: a few students switch courses within Kopplungen.
  // Later, some students join a course of a Kopplung they had none in.
  const moves: Array<Move> = [];
  const moving = new Set<number>();
  const secondOpening = [...opening][1] ?? "";

  const meetingDays = (course: Draft, when: (week: string) => boolean) =>
    schoolDays.filter(
      (day) =>
        when(day.week) &&
        course.meetings.some(
          (m) =>
            m.weekday === day.weekday && (m.only === undefined || m.only === labels.get(day.week)),
        ),
    );

  const changes = pitfalls.rosterChanges;
  const movers = changes === undefined ? 0 : Math.max(1, perTerm(changes.people, terms));

  const switches =
    changes === undefined ? 0 : Math.max(1, Math.round(changes.count / terms / movers / 2));

  // A switch shows as a roster change only when the course switched to meets in the opening
  // weeks both before and on the day, so only such switches are drawn.
  const switchesOf = (student: number) =>
    kopplungen.flatMap((kopplung) => {
      const from = kopplung.courses.find((c) => c.roster.includes(student));

      return from === undefined
        ? []
        : kopplung.courses.flatMap((to) => {
            const date = meetingDays(to, (week) => week === secondOpening).at(-1);

            const earlier = meetingDays(to, (week) => opening.has(week)).some(
              (day) => date !== undefined && day.date < date.date,
            );

            return to === from || date === undefined || !earlier
              ? []
              : [{ student, from: from.id, to: to.id, date: date.date, kopplung }];
          });
    });

  // A student WebUntis hides can't show a move.
  const eligible = students.flatMap((each) => {
    const found = hiddenFrom.has(each.id) ? [] : switchesOf(each.id);

    return new Set(found.map((one) => one.kopplung)).size >= switches ? [found] : [];
  });

  for (const found of (yield* Random.shuffle(eligible)).slice(0, movers)) {
    const done = new Set<number>();

    for (const { kopplung, ...move } of yield* Random.shuffle(found)) {
      const index = kopplungen.indexOf(kopplung);

      if (done.has(index) || done.size >= switches) continue;

      done.add(index);
      moving.add(move.student);
      moves.push(move);
    }
  }

  // A join comes early enough to meet in most later weeks, as corpus v1's did.
  const joinWeeks = new Set(fullWeeks.slice(2, 4));
  const joins = pitfalls.lateJoins;
  const joiners = joins === undefined ? 0 : perTerm(joins.people, terms);

  // Only a course of a Kopplung the student has nothing in, meeting in the join weeks, can be one.
  const joinsOf = (student: Student) =>
    kopplungen.flatMap((kopplung) =>
      kopplung.grade !== student.grade ||
      kopplung.courses.some((c) => c.roster.includes(student.id))
        ? []
        : kopplung.courses.flatMap((to) =>
            meetingDays(to, (week) => joinWeeks.has(week)).map((day) => ({
              student: student.id,
              from: undefined,
              to: to.id,
              date: day.date,
            })),
          ),
    );

  const joinable = students.flatMap((each) => {
    const found = moving.has(each.id) || hiddenFrom.has(each.id) ? [] : joinsOf(each);

    return found.length === 0 ? [] : [found];
  });

  for (const found of (yield* Random.shuffle(joinable)).slice(0, joiners)) {
    const [join] = yield* Random.shuffle(found);

    if (join !== undefined) moves.push(join);
  }

  // Teachers and rooms, free in every slot of a course where one is.
  const teacherBusy = new Map<number, Set<string>>();
  const roomBusy = new Map<number, Set<string>>();

  const load = (map: ReadonlyMap<number, ReadonlySet<string>>, each: Resource) =>
    map.get(each.id)?.size ?? 0;

  const isFree = (
    map: ReadonlyMap<number, ReadonlySet<string>>,
    each: Resource,
    meetings: ReadonlyArray<Meeting>,
  ) =>
    meetings.every((meeting) =>
      slotKeys(meeting).every((key) => !(map.get(each.id)?.has(key) ?? false)),
    );

  const take = (
    map: Map<number, Set<string>>,
    each: Resource,
    meetings: ReadonlyArray<Meeting>,
  ) => {
    const keys = map.get(each.id) ?? new Set<string>();

    for (const meeting of meetings) for (const key of slotKeys(meeting)) keys.add(key);
    map.set(each.id, keys);
  };

  const shuffledTeachers = yield* Random.shuffle(teachers);
  const shuffledRooms = yield* Random.shuffle(rooms);
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));

  for (const draft of drafts) {
    const wanted = Math.min(2, Math.max(1, yield* draw(calibration.teachers.perCourse, 1)));
    const hinted = byId.get(draft.teacherOf ?? "")?.teachers ?? [];

    const candidates = [...shuffledTeachers].sort(
      (a, b) => load(teacherBusy, a) - load(teacherBusy, b),
    );

    const chosen = [
      ...hinted,
      ...candidates.filter(
        (each) => !hinted.includes(each) && isFree(teacherBusy, each, draft.meetings),
      ),
    ].slice(0, Math.max(wanted, hinted.length));

    draft.teachers = chosen.length > 0 ? chosen : candidates.slice(0, 1);

    for (const each of draft.teachers) take(teacherBusy, each, draft.meetings);

    const roomed = (yield* draw(calibration.rooms.perCourse, 1)) > 0;

    const inherited =
      draft.teacherOf !== undefined && draft.meetings.every((m) => m.block === lunch)
        ? byId.get(draft.teacherOf)?.room
        : undefined;

    const room =
      inherited !== undefined && isFree(roomBusy, inherited, draft.meetings)
        ? inherited
        : [...shuffledRooms]
            .sort((a, b) => load(roomBusy, a) - load(roomBusy, b))
            .find((each) => isFree(roomBusy, each, draft.meetings));

    draft.room = roomed ? room : undefined;

    if (draft.room !== undefined) take(roomBusy, draft.room, draft.meetings);
  }

  // Lower-school lessons of the same teachers, which their views show and no measure counts.
  const share = Math.min(90, calibration.lowerSchool.share);

  const lowerClasses = Array.from(
    { length: Math.min(36, calibration.lowerSchool.classes) },
    (_, i) => resource(40_000 + id(), `${5 + Math.floor(i / 6)}.${(i % 6) + 1}`),
  );

  classes.push(...lowerClasses);

  for (const teacher of teachers) {
    const upper = load(teacherBusy, teacher) / 2;
    const count = Math.min(16, Math.round((upper * share) / Math.max(100 - share, 10)));

    for (let n = 0; n < count && lowerClasses.length > 0; n++) {
      const [schoolClass] = yield* Random.shuffle(lowerClasses);
      const [kind] = yield* Random.shuffle(lowerSubjects);

      const slots = yield* Random.shuffle(
        weekdays.flatMap((weekday) =>
          [1, 2, 3, 4].map((block) => ({ weekday, block, only: undefined })),
        ),
      );

      const meeting = slots.find((each) => isFree(teacherBusy, teacher, [each]));

      if (schoolClass === undefined || kind === undefined || meeting === undefined) continue;

      take(teacherBusy, teacher, [meeting]);
      drafts.push({
        id: `${schoolClass.shortName} ${kind.code} ${teacher.shortName} ${n}`,
        grade: 5 + Math.floor(lowerClasses.indexOf(schoolClass) / 6),
        subject: subjectOf(kind),
        classes: [schoolClass],
        meetings: [meeting],
        roster: [],
        kopplung: undefined,
        teacherOf: undefined,
        teachers: [teacher],
        room: undefined,
        lower: true,
      });
    }
  }

  const courses: ReadonlyArray<Course> = drafts.map(
    ({ id: course, grade, subject, classes: of, teachers: by, room, meetings, lower }) => ({
      id: course,
      grade,
      subject,
      classes: of,
      teachers: by,
      room,
      meetings,
      lower,
    }),
  );

  const memberships: Array<Membership> = drafts.flatMap((draft) =>
    draft.roster.map((student) => {
      const left = moves.find((each) => each.student === student && each.from === draft.id);

      return {
        course: draft.id,
        student,
        from: range.start,
        until: left === undefined ? range.end : previousDay(left.date),
      };
    }),
  );

  for (const each of moves)
    memberships.push({ course: each.to, student: each.student, from: each.date, until: range.end });

  const everyone = students.map((student) => ({
    ...student,
    hiddenFrom: hiddenFrom.get(student.id),
  }));

  const { corpus, courseOf } = yield* encode({
    seed,
    calibration,
    courses,
    memberships,
    students: everyone,
    classes,
    teachers,
    rooms,
    subjects: [...subjects.values()],
    sharedOf: new Map(shared.map((each) => [each.id, each.teacherOf ?? ""])),
    moves,
  });

  return { corpus, courses, memberships, students: everyone, moves, courseOf } satisfies School;
});

const previousDay = (date: string) => {
  const index = calendar.findIndex((day) => day.date === date);

  return calendar[Math.max(0, index - 1)]?.date ?? date;
};

interface Change {
  readonly status: "CHANGED" | "CANCELLED";
  readonly teachers?: ReadonlyArray<Resource>;
  readonly room?: Resource;
  readonly text: string;
}

/** One entry WebUntis shows: a course's meeting on a date, possibly changed or added. */
interface Occurrence {
  readonly ids: ReadonlyArray<number>;
  readonly date: string;
  readonly block: number;
  readonly course: Course;
  readonly change: Change | undefined;
  readonly added: boolean;
}

/** The school's corpus: every view, the directories, exams and labelled cases. */
const encode = Effect.fnUntraced(function* (school: {
  readonly seed: number;
  readonly calibration: Calibration.Calibration;
  readonly courses: ReadonlyArray<Course>;
  readonly memberships: ReadonlyArray<Membership>;
  readonly students: ReadonlyArray<Student>;
  readonly classes: ReadonlyArray<Resource>;
  readonly teachers: ReadonlyArray<Resource>;
  readonly rooms: ReadonlyArray<Resource>;
  readonly subjects: ReadonlyArray<Resource>;
  readonly sharedOf: ReadonlyMap<string, string>;
  readonly moves: ReadonlyArray<Move>;
}) {
  const { calibration, courses, memberships, students } = school;
  let nextIds = 1_000_000;
  const occurrences: Array<Occurrence> = [];

  const teacherAt = new Map<string, Set<number>>();
  const roomAt = new Map<string, Set<number>>();

  const at = (map: Map<string, Set<number>>, key: string) => {
    const known = map.get(key) ?? new Set<number>();

    map.set(key, known);

    return known;
  };

  const meets = (day: Day, meeting: Meeting) =>
    meeting.weekday === day.weekday &&
    (meeting.only === undefined || meeting.only === labels.get(day.week));

  for (const day of schoolDays) {
    for (const course of courses) {
      for (const meeting of course.meetings) {
        if (!meets(day, meeting)) continue;

        for (const teacher of course.teachers)
          at(teacherAt, `${day.date} ${meeting.block}`).add(teacher.id);

        if (course.room !== undefined)
          at(roomAt, `${day.date} ${meeting.block}`).add(course.room.id);
      }
    }
  }

  const rate = (bins: Parameters<typeof draw>[0]) => draw(bins, 0);
  const weeks = [...labels.keys()];

  for (const week of weeks) {
    const cancelled = yield* rate(calibration.changes.cancelled);
    const substituted = yield* rate(calibration.changes.substituted);
    const roomChanged = yield* rate(calibration.changes.roomChanged);
    const added = yield* rate(calibration.changes.added);
    const days = schoolDays.filter((day) => day.week === week);
    const upper: Array<Occurrence> = [];

    for (const day of days) {
      for (const course of courses) {
        for (const meeting of course.meetings) {
          if (!meets(day, meeting)) continue;

          const ids = [nextIds, nextIds + 3];

          nextIds += 6;

          const roll = yield* Random.nextIntBetween(0, 1000, { halfOpen: true });
          const slot = `${day.date} ${meeting.block}`;
          const plain = course.lower || school.sharedOf.has(course.id);

          let change: Change | undefined;

          if (!plain && roll < cancelled) change = { status: "CANCELLED", text: "Entfall" };
          else if (!plain && roll < cancelled + substituted) {
            const [substitute] = yield* Random.shuffle(
              school.teachers.filter((each) => !at(teacherAt, slot).has(each.id)),
            );

            if (substitute !== undefined) {
              at(teacherAt, slot).add(substitute.id);
              change = { status: "CHANGED", teachers: [substitute], text: "Vertretung" };
            }
          } else if (
            !plain &&
            course.room !== undefined &&
            roll < cancelled + substituted + roomChanged
          ) {
            const [room] = yield* Random.shuffle(
              school.rooms.filter((each) => !at(roomAt, slot).has(each.id)),
            );

            if (room !== undefined) {
              at(roomAt, slot).add(room.id);
              change = { status: "CHANGED", room, text: "Raumänderung" };
            }
          }

          const occurrence = {
            ids,
            date: day.date,
            block: meeting.block,
            course,
            change,
            added: false,
          };

          occurrences.push(occurrence);

          if (!plain) upper.push(occurrence);
        }
      }
    }

    // Lessons WebUntis adds in the last block, which the courses' students see.
    for (let n = 0; n < Math.round((upper.length * added) / 1000); n++) {
      const [model] = yield* Random.shuffle(upper);

      if (model === undefined) break;

      occurrences.push({
        ...model,
        ids: [nextIds, nextIds + 3],
        block: 5,
        change: undefined,
        added: true,
      });
      nextIds += 6;
    }
  }

  const membersOf = new Map<string, Array<Membership>>();

  for (const each of memberships)
    membersOf.set(each.course, [...(membersOf.get(each.course) ?? []), each]);

  const attending = (occurrence: Occurrence) =>
    (membersOf.get(occurrence.course.id) ?? []).filter(
      (each) => each.from <= occurrence.date && occurrence.date <= each.until,
    );

  const teachersNow = ({ course, change }: Occurrence) => change?.teachers ?? course.teachers;
  const roomNow = ({ course, change }: Occurrence) => change?.room ?? course.room;

  type View = { readonly type: WebUntisBodies.ViewType; readonly resource: Resource };

  const entry = (view: View) => (occurrence: Occurrence) => {
    const { ids, date, block, course, change, added } = occurrence;
    const [start, end] = timesOf(block);
    const ownTeacher = view.type === "TEACHER" && change?.teachers === undefined;
    const ownRoom = view.type === "ROOM" && change?.room === undefined;
    const planned = course.teachers.filter((each) => !(ownTeacher && each === view.resource));
    const now = teachersNow(occurrence).filter((each) => !(ownTeacher && each === view.resource));

    const plannedRoom =
      course.room === undefined || (ownRoom && course.room === view.resource) ? [] : [course.room];

    const currentRoom = roomNow(occurrence);

    const roomNowList =
      currentRoom === undefined || (ownRoom && currentRoom === view.resource) ? [] : [currentRoom];

    return {
      ids,
      duration: { start: `${date}T${start}`, end: `${date}T${end}` },
      type: "NORMAL_TEACHING_PERIOD",
      status: added ? "ADDITIONAL" : (change?.status ?? "REGULAR"),
      statusDetail: null,
      name: null,
      layoutStartPosition: 0,
      layoutWidth: 1000,
      layoutGroup: 0,
      color: "#9fc5e8",
      notesAll: "",
      icons: [],
      position1:
        planned.length === 0 && now.length === 0 ? null : positions("TEACHER", now, planned),
      position2: [{ current: position("SUBJECT", "REGULAR", course.subject), removed: null }],
      position3:
        plannedRoom.length === 0 && roomNowList.length === 0
          ? null
          : positions("ROOM", roomNowList, plannedRoom),
      position4: course.classes
        .filter((each) => !(view.type === "CLASS" && each === view.resource))
        .map((each) => ({ current: position("CLASS", "REGULAR", each), removed: null })),
      texts: [],
      lessonText: "",
      lessonInfo: null,
      substitutionText: added ? "Vertretung" : (change?.text ?? null),
    };
  };

  const byStudent = new Map<number, Array<Occurrence>>();
  const byClass = new Map<number, Array<Occurrence>>();
  const byTeacher = new Map<number, Array<Occurrence>>();
  const byRoom = new Map<number, Array<Occurrence>>();

  const push = (map: Map<number, Array<Occurrence>>, key: number, occurrence: Occurrence) => {
    const known = map.get(key);

    if (known === undefined) map.set(key, [occurrence]);
    else known.push(occurrence);
  };

  for (const occurrence of occurrences) {
    for (const each of occurrence.course.classes) push(byClass, each.id, occurrence);

    for (const each of teachersNow(occurrence)) push(byTeacher, each.id, occurrence);

    const room = roomNow(occurrence);

    if (room !== undefined) push(byRoom, room.id, occurrence);

    for (const each of attending(occurrence)) push(byStudent, each.student, occurrence);
  }

  const hiddenFrom = new Map(students.map((student) => [student.id, student.hiddenFrom]));

  const timetable = (view: View, shown: ReadonlyArray<Occurrence>) => {
    const hidden = view.type === "STUDENT" ? hiddenFrom.get(view.resource.id) : undefined;
    const onDate = new Map<string, Array<Occurrence>>();

    for (const each of shown) onDate.set(each.date, [...(onDate.get(each.date) ?? []), each]);

    return {
      format: 2,
      days: calendar.map(({ date }) => {
        const entries = onDate.get(date) ?? [];
        const blocked = hidden !== undefined && date >= hidden;

        return {
          date,
          resourceType: view.type,
          resource: display(view.resource),
          status: blocked ? "NOT_ALLOWED_FOR_RESOURCE" : entries.length > 0 ? "REGULAR" : "NO_DATA",
          dayEntries: [],
          gridEntries: blocked ? [] : entries.map(entry(view)),
          backEntries: [],
        };
      }),
      errors: [],
    };
  };

  const views: ReadonlyArray<readonly [View, ReadonlyArray<Occurrence>]> = [
    ...school.classes.map(
      (each) => [{ type: "CLASS", resource: each }, byClass.get(each.id) ?? []] as const,
    ),
    ...school.teachers.map(
      (each) => [{ type: "TEACHER", resource: each }, byTeacher.get(each.id) ?? []] as const,
    ),
    ...school.rooms.map(
      (each) => [{ type: "ROOM", resource: each }, byRoom.get(each.id) ?? []] as const,
    ),
    ...students.map(
      (each) => [{ type: "STUDENT", resource: each }, byStudent.get(each.id) ?? []] as const,
    ),
  ];

  const entryReads = views.map(([view, shown]): readonly [string, RecordedWebUntis.Read] => [
    RecordedWebUntis.paths.entries(year.id, view.type, view.resource.id),
    { versions: [{ observedAt: capturedAt, ...range, body: timetable(view, shown) }] },
  ]);

  // Exams of upper-school courses, each at one of its lessons after the opening weeks.
  const exams: Array<RecordedWebUntis.Version["body"]> = [];

  for (const course of courses.filter((each) => !each.lower && !school.sharedOf.has(each.id))) {
    const count = Math.min(3, yield* draw(calibration.exams, 0));

    const candidates = occurrences.filter(
      (each) =>
        each.course === course &&
        !each.added &&
        each.change?.status !== "CANCELLED" &&
        !opening.has(labelWeek(each.date)),
    );

    for (const occurrence of (yield* Random.shuffle(candidates)).slice(0, count)) {
      const [start, end] = timesOf(occurrence.block);
      const present = new Set(attending(occurrence).map((each) => each.student));
      const attendees = students.filter((student) => present.has(student.id));
      const teacher = course.teachers[0];

      exams.push({
        examId: 900_000 + exams.length,
        examType: { ...display(resource(1, "KL", "Klausur")), gradingScaleId: 1 },
        gradingScale: display(resource(1, "P", "Punkte")),
        examName: "Klausur",
        examText: "",
        examStart: `${occurrence.date}T${start}`,
        examEnd: `${occurrence.date}T${end}`,
        examDuration: 80,
        examBooked: "2026-08-20T10:00",
        examBookedUser: teacher === undefined ? null : display(teacher),
        examReturned: null,
        examReturnedUser: null,
        examModified: "2026-08-20T10:00",
        examModifiedUser: teacher === undefined ? null : display(teacher),
        numStudents: attendees.length,
        subject: display(course.subject),
        classes: course.classes.map(display),
        teachers: course.teachers.map(display),
        studentgroup: display(
          resource(800_000 + exams.length, `${course.subject.shortName} Klausur`),
        ),
        students: attendees.map(WebUntisBodies.examStudent),
        invigilators: [],
        rooms: course.room === undefined ? [] : [display(course.room)],
        lessonId: 7_000 + exams.length,
        exported: false,
        deleted: false,
        isUntisExam: false,
        canEdit: false,
        canDelete: false,
        canReadGrades: false,
        canWriteGrades: false,
      });
    }
  }

  const reads: RecordedWebUntis.Recording = new Map([
    ...WebUntisBodies.masterReads(capturedAt, {
      year,
      blocks,
      tenant: "Synthetische Schule",
      holidays,
    }),
    ...WebUntisBodies.directories(capturedAt, year, {
      classes: school.classes,
      teachers: school.teachers,
      subjects: school.subjects,
      rooms: school.rooms,
      students,
    }),
    [
      RecordedWebUntis.paths.exams(year.id),
      WebUntisBodies.once(capturedAt, { exams, withDeleted: true }),
    ],
    ...entryReads,
  ]);

  // Labelled cases where rosters alone can't say what is one course.
  const firstIn = (course: string, when: (date: string) => boolean) =>
    occurrences.find((each) => each.course.id === course && !each.added && when(each.date));

  const inOpening = (date: string) => opening.has(labelWeek(date));

  const ref = (occurrence: Occurrence | undefined) =>
    occurrence === undefined ? [] : [{ date: occurrence.date, ids: occurrence.ids }];

  const sameCode = courses.flatMap((a, i) =>
    courses
      .slice(i + 1)
      .filter(
        (b) =>
          !a.lower &&
          !b.lower &&
          a.subject === b.subject &&
          a.classes === b.classes &&
          !school.sharedOf.has(a.id) &&
          !school.sharedOf.has(b.id),
      )
      .map((b) => ({ a: a.id, b: b.id })),
  );

  const caseCourses = [
    ...sameCode.map(({ a, b }, n) => ({
      id: `same-code-${n + 1}`,
      same: false,
      entries: [...ref(firstIn(a, inOpening)), ...ref(firstIn(b, inOpening))],
    })),
    ...[...school.sharedOf].map(([wide, group], n) => ({
      id: `shared-${n + 1}`,
      same: false,
      entries: [...ref(firstIn(wide, inOpening)), ...ref(firstIn(group, inOpening))],
    })),
    ...school.moves
      .filter((each) => inOpening(each.date))
      .flatMap((each, n) =>
        [each.from, each.to].flatMap((course, side) =>
          course === undefined
            ? []
            : [
                {
                  id: `roster-change-${n + 1}-${side === 0 ? "left" : "joined"}`,
                  same: true,
                  entries: [
                    ...ref(firstIn(course, (date) => inOpening(date) && date < each.date)),
                    ...ref(firstIn(course, (date) => inOpening(date) && date >= each.date)),
                  ],
                },
              ],
        ),
      ),
  ].filter((each) => each.entries.length === 2);

  const corpus = {
    manifest: {
      id: `synthetic-${school.seed}`,
      capturedAt,
      policy: 0,
      timeZone: CoreSchool.defaultTimeZone,
      ranges: [range],
    },
    reads,
    cases: {
      changes: [],
      weeks: [...labels].map(([week, label]) => ({ id: `week-${week}`, week, label })),
      closures: [],
      courses: caseCourses,
      terms: [],
    },
  } satisfies Corpus.Corpus;

  return {
    corpus,
    courseOf: new Map(
      occurrences.map((each) => [`${each.date} ${each.ids.join("+")}`, each.course.id] as const),
    ),
  };
});

const weekByDate = new Map(calendar.map((day) => [day.date, day.week]));

const labelWeek = (date: string) => weekByDate.get(date) ?? "";

/** The synthetic school follows IGS's rules for classes and changes. */
export const profile = (corpus: Corpus.Corpus): SchoolProfile.SchoolProfile => ({
  ...IgsLilienthal.profile,
  id: CoreSchool.Id.make(corpus.manifest.id),
  school: { name: "Synthetische Schule", timeZone: CoreSchool.defaultTimeZone },
});
