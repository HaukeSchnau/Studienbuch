import type { SubjectArt } from "@stu/domain-ui/subject/SubjectArt";
import { SubjectMark } from "@stu/domain-ui/subject/SubjectMark";
import type { AgendaItem } from "@stu/domain-ui/timetable/AgendaItem";
import type { WeekItem } from "@stu/domain-ui/timetable/WeekItem";
import type { Tokens } from "@stu/ui/Tokens";
import { useReducer } from "react";

import type { Exam } from "#/domain-ui/app/GradesCard.tsx";
import type { Homework } from "#/domain-ui/app/HomeworkCard.tsx";
import type { AbsenceEntry } from "#/domain-ui/app/AbsenceCard.tsx";

// The landing page's demo data: Wednesday 28 October 2026 at 10:31, KW 44, as in the design mocks.
// Names are invented.
export * as Demo from "./Demo.ts";

export const student = "Lena";
export const clock = "10:31";

export type CourseId = "ma" | "de" | "en" | "bi";

export interface Course {
  readonly name: string;
  readonly slot: Tokens.SubjectSlot;
  readonly teacher: string;
  readonly term: string;
  readonly oral: { readonly points: number; readonly date: string; readonly confirmed: boolean };
  readonly exams: ReadonlyArray<Exam>;
}

export const courses: Readonly<Record<CourseId, Course>> = {
  de: {
    name: "Deutsch",
    slot: "rust",
    teacher: "Fr. Albers",
    term: "Winter 2026/27",
    oral: { points: 12, date: "19.10.", confirmed: true },
    exams: [
      {
        id: "de-1",
        points: 13,
        title: "Erörterung",
        date: "22.10.",
        teacher: true,
        parents: false,
      },
      { id: "de-2", points: 11, title: "Lyrik", date: "24.09.", teacher: true, parents: true },
    ],
  },
  ma: {
    name: "Mathematik",
    slot: "blue",
    teacher: "Hr. Brandt",
    term: "Winter 2026/27",
    oral: { points: 10, date: "21.10.", confirmed: true },
    exams: [
      { id: "ma-1", points: 9, title: "Funktionen", date: "16.10.", teacher: true, parents: false },
      { id: "ma-2", points: 12, title: "Stochastik", date: "18.09.", teacher: true, parents: true },
    ],
  },
  en: {
    name: "Englisch",
    slot: "violet",
    teacher: "Fr. Oka",
    term: "Winter 2026/27",
    oral: { points: 13, date: "23.10.", confirmed: true },
    exams: [
      {
        id: "en-1",
        points: 12,
        title: "Short Story",
        date: "20.10.",
        teacher: true,
        parents: false,
      },
      { id: "en-2", points: 14, title: "Mediation", date: "29.09.", teacher: true, parents: true },
    ],
  },
  bi: {
    name: "Biologie",
    slot: "green",
    teacher: "Hr. Yilmaz",
    term: "Winter 2026/27",
    oral: { points: 11, date: "14.10.", confirmed: false },
    exams: [
      { id: "bi-1", points: 10, title: "Genetik", date: "15.10.", teacher: true, parents: false },
      {
        id: "bi-2",
        points: 8,
        title: "Zellbiologie",
        date: "17.09.",
        teacher: true,
        parents: true,
      },
    ],
  },
};

/** The app's subject sticker, by course. */
export const art: Readonly<Record<CourseId, SubjectArt.Name>> = {
  de: "german",
  ma: "math",
  en: "english",
  bi: "biology",
};

/** Mean points of the exams both teacher and parents have signed. */
export const confirmedAverage = (exams: ReadonlyArray<Exam>) => {
  const confirmed = exams.filter((exam) => exam.teacher && exam.parents);

  return confirmed.length === 0
    ? undefined
    : Math.round(confirmed.reduce((sum, exam) => sum + exam.points, 0) / confirmed.length);
};

/** Today's agenda at 10:31, as the app words it. Lesson ids are course ids, so a lesson opens its course. */
export const today: ReadonlyArray<AgendaItem.Item> = [
  {
    kind: "lesson",
    id: "ma",
    time: "08:00–09:30",
    subject: "Mathematik",
    mark: SubjectMark.ofSubject({ name: "Mathematik", shortName: "MA" }),
    teacher: { now: "Brandt" },
    room: { now: "R 2.14" },
    phase: "past",
  },
  {
    kind: "lesson",
    id: "de",
    time: "09:45–11:15",
    subject: "Deutsch",
    mark: SubjectMark.ofSubject({ name: "Deutsch", shortName: "DE" }),
    teacher: { now: "Albers" },
    room: { now: "R 1.07" },
    phase: "now",
    remaining: "Noch 44 Minuten",
  },
  {
    kind: "lesson",
    id: "en",
    time: "11:30–13:00",
    subject: "Englisch",
    mark: SubjectMark.ofSubject({ name: "Englisch", shortName: "EN" }),
    teacher: { now: "Wendt", was: "Oka" },
    room: { now: "R 1.12" },
    phase: "later",
    note: "Vertretung",
  },
  { kind: "free", id: "free", time: "13:50–15:15" },
  {
    kind: "lesson",
    id: "bi",
    time: "15:15–16:45",
    subject: "Biologie",
    mark: SubjectMark.ofSubject({ name: "Biologie", shortName: "BI" }),
    teacher: { now: "Yilmaz" },
    room: { now: "R 0.12" },
    phase: "later",
    off: "Entfall",
  },
];

export const isCourse = (id: string): id is CourseId => id in courses;

export const homework: ReadonlyArray<Homework> = [
  {
    id: "hw-ma",
    subject: "Mathe",
    slot: "blue",
    title: "S. 84, Nr. 3 bis 7",
    due: "bis morgen",
    done: true,
    pending: false,
  },
  {
    id: "hw-en",
    subject: "Englisch",
    slot: "violet",
    title: "Vokabeln Unit 6",
    due: "bis Freitag",
    done: false,
    pending: false,
  },
  {
    id: "hw-de",
    subject: "Deutsch",
    slot: "rust",
    title: "Erörterung überarbeiten",
    due: "bis Montag",
    done: false,
    pending: false,
  },
];

/** The October absences: one day still waits for its excuse, two hours on Thursday the 15th. */
export const absences: ReadonlyArray<AbsenceEntry> = [
  { id: "ab-12", date: "Mo, 12.10.", hours: 1, reason: "Arzttermin", excused: true },
  { id: "ab-14", date: "Mi, 14.10.", hours: 2, reason: "krank", excused: true },
  { id: "ab-15", date: "Do, 15.10.", hours: 2, reason: undefined, excused: false },
];

const at = (hour: number, minute: number) => (hour * 60 + minute) * 60_000;

const hhmm = (time: number) => {
  const minutes = time / 60_000;

  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

/** The school day's periods, as today's agenda has them. */
const periods = [
  [at(8, 0), at(9, 30)],
  [at(9, 45), at(11, 15)],
  [at(11, 30), at(13, 0)],
  [at(13, 50), at(15, 15)],
  [at(15, 15), at(16, 45)],
] as const;

interface Week {
  readonly number: number;
  /** IGS alternates A and B weeks. */
  readonly kind: "A-Woche" | "B-Woche";
  /** "26.–30. Oktober" */
  readonly dates: string;
  readonly grid: WeekItem.Week;
}

const subjects = {
  Mathe: ["Mathematik", "MA", "Brandt", "R 2.14"],
  Bio: ["Biologie", "BI", "Yilmaz", "R 0.12"],
  Deutsch: ["Deutsch", "DE", "Albers", "R 1.07"],
  Englisch: ["Englisch", "EN", "Oka", "R 1.12"],
  Chemie: ["Chemie", "CH", "Kowalski", "R 0.14"],
  Spanisch: ["Spanisch", "SN", "Ortega", "R 1.15"],
  PoWi: ["Politik-Wirtschaft", "PW", "Nguyen", "R 2.03"],
  "Gesch.": ["Geschichte", "GE", "Hartmann", "R 2.10"],
  Sport: ["Sport", "SP", "Berger", "Halle"],
  Seminar: ["Seminarfach", "SF", "Lindner", "R 1.20"],
} as const;

type Subject = keyof typeof subjects;

const weekdays = ["Mo", "Di", "Mi", "Do", "Fr"] as const;

const longWeekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"] as const;

/** Monday to Friday from the day of the month `monday`, with `today` as an index. */
const days = (monday: number, today?: number): ReadonlyArray<WeekItem.Day> =>
  weekdays.map((short, index) => ({
    id: short,
    short,
    long: longWeekdays[index] ?? "",
    date: `${String(monday + index)}.`,
    today: index === today,
  }));

// Wednesday 10:31 of the current week.
const now = { day: 2, time: at(10, 31) };

/** One day's periods; `null` is a free period. `changes` are by period. */
const cells = (
  day: number,
  plan: ReadonlyArray<Subject | null>,
  current: boolean,
  changes: Readonly<Partial<Record<number, Partial<WeekItem.Cell>>>> = {},
) =>
  plan.flatMap((subject, period): ReadonlyArray<WeekItem.Cell> => {
    const [start, end] = periods[period] ?? [0, 0];

    if (subject === null || end === 0) return [];

    const [name, shortName, teacher, room] = subjects[subject];

    const phase =
      !current || day > now.day || (day === now.day && start > now.time)
        ? "later"
        : day < now.day || end <= now.time
          ? "past"
          : "now";

    return [
      {
        kind: "lesson",
        id: `${String(day)}-${String(period)}`,
        day,
        start,
        end,
        lane: 0,
        lanes: 1,
        time: `${hhmm(start)}–${hhmm(end)}`,
        subject: name,
        short: subject,
        mark: SubjectMark.ofSubject({ name, shortName }),
        teacher: { now: teacher },
        room: { now: room },
        phase,
        ...changes[period],
      },
    ];
  });

const hours = { start: at(8, 0), end: at(16, 45), labels: periods.map(([start]) => start) };

export const weeks: ReadonlyArray<Week> = [
  {
    number: 43,
    kind: "A-Woche",
    dates: "19.–23. Oktober",
    grid: {
      days: days(19),
      hours: undefined,
      cells: [],
      spans: [
        { kind: "closure", from: 0, to: 4, name: "Herbstferien", until: "bis Sa, 24. Oktober" },
      ],
    },
  },
  {
    number: 44,
    kind: "B-Woche",
    dates: "26.–30. Oktober",
    grid: {
      days: days(26, now.day),
      hours,
      cells: [
        ...cells(0, ["Mathe", "Englisch", "Deutsch", "Gesch.", "Seminar"], true),
        ...cells(1, ["Bio", "Chemie", "PoWi", "Sport", null], true),
        ...cells(2, ["Mathe", "Deutsch", "Englisch", null, "Bio"], true, {
          2: { teacher: { now: "Wendt", was: "Oka" }, note: "Vertretung" },
          4: { off: "Entfall" },
        }),
        ...cells(3, ["Deutsch", "Spanisch", "Chemie", "Bio", null], true, {
          1: { room: { now: "R 2.01", was: "R 1.15" }, note: "Raumänderung" },
        }),
        ...cells(4, ["Englisch", "Mathe", "Gesch.", "PoWi", null], true),
      ],
      spans: [],
      now,
    },
  },
  {
    number: 45,
    kind: "A-Woche",
    dates: "2.–6. November",
    grid: {
      days: days(2),
      hours,
      cells: [
        ...cells(0, ["Mathe", "Englisch", "Deutsch", "Spanisch", null], false),
        ...cells(1, ["Bio", "Chemie", "PoWi", "Sport", "Seminar"], false),
        ...cells(2, ["Mathe", "Deutsch", "Englisch", "Gesch.", null], false),
        ...cells(3, ["Deutsch", "Spanisch", "Chemie", null, null], false),
        ...cells(4, ["Englisch", "Mathe", "Gesch.", "PoWi", "Sport"], false),
      ],
      spans: [],
    },
  },
];

/** The drifting strip: subject stickers from the app on their course colour. */
export const strip: ReadonlyArray<{
  readonly art: SubjectArt.Name;
  readonly label: string;
  readonly slot: Tokens.SubjectSlot;
}> = [
  { art: "math", label: "Mathe", slot: "blue" },
  { art: "german", label: "Deutsch", slot: "rust" },
  { art: "english", label: "Englisch", slot: "violet" },
  { art: "biology", label: "Biologie", slot: "green" },
  { art: "history", label: "Geschichte", slot: "amber" },
  { art: "computing", label: "Informatik", slot: "indigo" },
  { art: "chemistry", label: "Chemie", slot: "teal" },
  { art: "sport", label: "Sport", slot: "red" },
  { art: "art", label: "Kunst", slot: "magenta" },
  { art: "physics", label: "Physik", slot: "cyan" },
  { art: "music", label: "Musik", slot: "olive" },
  { art: "latin", label: "Latein", slot: "slate" },
  { art: "french", label: "Französisch", slot: "rust" },
  { art: "religion", label: "Religion", slot: "blue" },
];

/** The index in `weeks` of the current week, KW 44. */
export const currentWeek = 1;

/** How long a ticked homework waits for the network, and how long "abgeglichen" stays, in ms. */
export const signalDelays = { back: 2400, settle: 3200 } as const;

/** What the visitor changed on the page. Sections showing the same record read the same state. */
/** The places on the page where an exam can be signed. Each keeps its own signatures. */
export type Signing = "today" | "grades" | "features";

export interface State {
  /** What the Übersicht phone shows: the day, or a course opened from it. */
  readonly todayScreen: "today" | CourseId;
  /** Exams the visitor had signed, per place. Signing adds the parents' signature. */
  readonly signed: Readonly<Record<Signing, ReadonlySet<string>>>;
  /** The offline card's homework. Its phone sits in a dead spot until a tick has waited a moment. */
  readonly homework: ReadonlyArray<Homework>;
  readonly signal: "none" | "waiting" | "synced";
  readonly vaultView: "device" | "server";
  /** Index into `weeks` of the week the closing phone shows. */
  readonly week: number;
}

export type Action =
  | { readonly kind: "open"; readonly course: CourseId }
  | { readonly kind: "back" }
  | { readonly kind: "sign"; readonly place: Signing; readonly exam: string }
  | { readonly kind: "tick"; readonly homework: string }
  | { readonly kind: "synced" }
  | { readonly kind: "settled" }
  | { readonly kind: "view"; readonly view: State["vaultView"] }
  | { readonly kind: "week"; readonly week: number };

const initial: State = {
  todayScreen: "today",
  signed: { today: new Set(), grades: new Set(), features: new Set() },
  homework,
  signal: "none",
  vaultView: "device",
  week: currentWeek,
};

const reduce = (state: State, action: Action): State => {
  switch (action.kind) {
    case "open":
      return { ...state, todayScreen: action.course };
    case "back":
      return { ...state, todayScreen: "today" };
    case "sign":
      return {
        ...state,
        signed: {
          ...state.signed,
          [action.place]: new Set(state.signed[action.place]).add(action.exam),
        },
      };
    case "tick":
      return {
        ...state,
        signal: "waiting",
        homework: state.homework.map((item) =>
          item.id === action.homework ? { ...item, done: !item.done, pending: true } : item,
        ),
      };
    case "synced":
      return {
        ...state,
        signal: "synced",
        homework: state.homework.map((item) => ({ ...item, pending: false })),
      };
    case "settled":
      return state.signal === "synced" ? { ...state, signal: "none" } : state;
    case "view":
      return { ...state, vaultView: action.view };
    case "week":
      return weeks[action.week] === undefined ? state : { ...state, week: action.week };
  }
};

/**
 * The landing page's demo state, held by the page and handed to its sections. It starts the same
 * on every visit and is gone on reload: nothing here outlives the page.
 */
export const useDemo = () => useReducer(reduce, initial);

export type Dispatch = ReturnType<typeof useDemo>[1];

/** The exams of `course`, with the visitor's signatures applied. */
export const signedExams = (course: CourseId, signed: ReadonlySet<string>) =>
  courses[course].exams.map((exam) => (signed.has(exam.id) ? { ...exam, parents: true } : exam));
