/**
 * Die Demoschule: a fictional school with the students Lena and Tom, which development servers and
 * previews offer persona sign-in for and the store's reviewers sign in to on beta. Its rows follow
 * from the school year and the school week the seed runs in, so two seeds in one week write the
 * same rows under the same ids. Names are invented.
 */
import { Demo } from "@stu/api/Demo";
import { CivilTime, type Course, type Lesson, Notebook, School, type Term } from "@stu/core";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Schools } from "../school/Schools.ts";

export * as DemoSchool from "./DemoSchool.ts";

export const id = School.Id.make("demo-schule");

/** Every demo course is offered to this grade level, and Lena and Tom are in it. */
export const gradeLevel = 11;

const school = { name: "Demoschule am Wiesengrund", timeZone: School.defaultTimeZone };

/** One course of each subject, `ma-1` and so on. A student takes Kunst or Musik. */
const subjects = [
  { id: "ma", name: "Mathematik", shortName: "MA" },
  { id: "de", name: "Deutsch", shortName: "DE" },
  { id: "en", name: "Englisch", shortName: "EN" },
  { id: "bi", name: "Biologie", shortName: "BI" },
  { id: "ch", name: "Chemie", shortName: "CH" },
  { id: "ge", name: "Geschichte", shortName: "GE" },
  { id: "pw", name: "Politik-Wirtschaft", shortName: "PW" },
  { id: "ku", name: "Kunst", shortName: "KU", groupKey: "kunst-musik", choiceRequired: true },
  { id: "mu", name: "Musik", shortName: "MU", groupKey: "kunst-musik", choiceRequired: true },
  { id: "sp", name: "Sport", shortName: "SP" },
] as const satisfies ReadonlyArray<Schools.SimpleSubject>;

type SubjectId = (typeof subjects)[number]["id"];

const course = (subject: SubjectId) => Schools.simpleCourse(subject);

type EncodedLesson = Schema.Struct.Encoded<(typeof Lesson.Row)["fields"]>;

/** Who teaches each subject, by short name, and where. */
const staff: Readonly<Record<SubjectId, { readonly teacher: string; readonly room: string }>> = {
  ma: { teacher: "BRA", room: "A101" },
  de: { teacher: "KLE", room: "A102" },
  en: { teacher: "HOF", room: "A103" },
  bi: { teacher: "WIN", room: "NW1" },
  ch: { teacher: "LOR", room: "NW2" },
  ge: { teacher: "SEI", room: "B201" },
  pw: { teacher: "MAR", room: "B202" },
  ku: { teacher: "FEL", room: "Kunstraum" },
  mu: { teacher: "OST", room: "Musikraum" },
  sp: { teacher: "DRE", room: "Sporthalle" },
};

/** Who stands in for a teacher. */
const substitute = "VOS";

const teacherId = (shortName: string) => shortName.toLowerCase();

const roomId = (name: string) => name.toLowerCase();

const at = (hour: number, minute: number) => (hour * 60 + minute) * 60_000;

/** The school day's three blocks. */
const blocks = [
  { start: at(8, 0), end: at(9, 30) },
  { start: at(9, 50), end: at(11, 20) },
  { start: at(11, 40), end: at(13, 10) },
];

/**
 * Monday to Friday, the subjects of each block. Lena's and Tom's own courses share a block, so each
 * of them has a full week.
 */
const timetable: ReadonlyArray<ReadonlyArray<ReadonlyArray<SubjectId>>> = [
  [["ma"], ["de"], ["bi", "ch"]],
  [["en"], ["ge", "pw"], ["sp"]],
  [["de"], ["ma"], ["ku", "mu"]],
  [["bi", "ch"], ["en"], ["ge", "pw"]],
  [["ma"], ["ku", "mu"], ["sp"]],
];

/** What changes in the week: a substitute in Wednesday's Mathematik, and Thursday's Englisch is off. */
const changes: ReadonlyArray<{
  readonly day: number;
  readonly block: number;
  readonly change: (lesson: EncodedLesson) => typeof lesson;
}> = [
  {
    day: 2,
    block: 1,
    change: (lesson) => ({
      ...lesson,
      teacherIds: [teacherId(substitute)],
      status: "Changed",
      change: {
        kind: "Substitution",
        previousTeacherIds: lesson.teacherIds,
        previousRoomIds: [],
      },
    }),
  },
  {
    day: 3,
    block: 1,
    change: (lesson) => ({
      ...lesson,
      status: "Cancelled",
      change: { kind: "Cancelled", previousTeacherIds: [], previousRoomIds: [] },
    }),
  },
];

const encodeDate = Schema.encodeEffect(CivilTime.PlainDate);

/** The lessons of the school week that holds `date`, or of the next one on a weekend, by course. */
const week = Effect.fn("DemoSchool.week")(function* (around: CivilTime.PlainDate) {
  const weekday = CivilTime.dayOfWeek(around);
  const monday = CivilTime.addDays(around, weekday <= 5 ? 1 - weekday : 8 - weekday);
  const lessons: Record<string, Record<string, EncodedLesson>> = {};

  for (const [day, plan] of timetable.entries()) {
    const date = yield* encodeDate(CivilTime.addDays(monday, day));

    for (const [block, time] of blocks.entries()) {
      for (const subject of plan[block] ?? []) {
        const courseId = course(subject);
        const { teacher, room } = staff[subject];

        const change = changes.find(
          (planned) => planned.day === day && planned.block === block,
        )?.change;

        const lesson: EncodedLesson = {
          courseId,
          date,
          ...time,
          teacherIds: [teacherId(teacher)],
          roomIds: [roomId(room)],
          status: "Regular",
        };

        lessons[courseId] = {
          ...lessons[courseId],
          [`${courseId}-${date}-${block + 1}`]: change === undefined ? lesson : change(lesson),
        };
      }
    }
  }

  return lessons;
}, Effect.orDie);

/** Today at the demo school, by the clock. */
export const today = Schools.today(school);

/**
 * The school's rows for the school year that holds `date`, with both terms offering every course,
 * and the lessons of its school week.
 */
export const data = Effect.fn("DemoSchool.data")(function* (date: CivilTime.PlainDate) {
  const simple = yield* Schools.simple({ id, school, today: date, gradeLevel, subjects });
  const shortNames = [...Object.values(staff).map(({ teacher }) => teacher), substitute];

  return {
    ...simple,
    data: {
      ...simple.data,
      teachers: Object.fromEntries(
        shortNames.map((name) => [teacherId(name), { shortName: name }]),
      ),
      rooms: Object.fromEntries(
        Object.values(staff).map(({ room }) => [roomId(room), { name: room }]),
      ),
      lessons: yield* week(date),
    } satisfies Schools.Data,
  };
});

export interface Persona {
  readonly account: string;
  readonly email: string;
  readonly notebook: Notebook.Id;
  readonly courses: ReadonlyArray<Course.Id>;
}

/**
 * Their addresses are under `Demo.emailDomain`, a domain of ours. The seed creates the accounts
 * before a sign-up could claim an address, and fails rather than adopt an account that has one.
 * The account and notebook ids are fixed, so every seed finds them again.
 */
export const personas: Readonly<Record<Demo.Persona, Persona>> = {
  lena: {
    account: Demo.accounts.lena,
    email: `lena@${Demo.emailDomain}`,
    notebook: Notebook.Id.make("demo-lena"),
    courses: (["ma", "de", "en", "bi", "ge", "ku", "sp"] as const).map(course),
  },
  tom: {
    account: Demo.accounts.tom,
    email: `tom@${Demo.emailDomain}`,
    notebook: Notebook.Id.make("demo-tom"),
    courses: (["ma", "de", "en", "ch", "pw", "mu", "sp"] as const).map(course),
  },
};

/** The persona's course choice in `term`. */
export const choice = (persona: Persona, term: Term.Id): Schools.Choice => ({
  termId: term,
  gradeLevel,
  courseIds: [...persona.courses].sort(),
});
