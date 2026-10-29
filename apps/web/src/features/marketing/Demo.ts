import type { Tokens } from "@stu/ui/Tokens";
import { useReducer } from "react";

import type { AgendaRow } from "#/domain-ui/app/AgendaCard.tsx";
import type { Exam } from "#/domain-ui/app/GradesCard.tsx";
import type { Homework } from "#/domain-ui/app/HomeworkCard.tsx";
import type { AbsenceEntry } from "#/domain-ui/app/AbsenceCard.tsx";
import type { WeekCell, WeekDay } from "#/domain-ui/app/WeekGrid.tsx";

// The landing page's demo data: Wednesday 28 October 2026 at 10:31, KW 44, as in the design mocks.
// Names are invented.
export * as Demo from "./Demo.ts";

export const student = "Lena";
export const clock = "10:31";

export type CourseId = "ma" | "de" | "en" | "bi";

export interface Course {
  readonly name: string;
  readonly teacher: string;
  readonly term: string;
  readonly oral: { readonly points: number; readonly date: string; readonly confirmed: boolean };
  readonly exams: ReadonlyArray<Exam>;
}

export const courses: Readonly<Record<CourseId, Course>> = {
  de: {
    name: "Deutsch",
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

/** The subject art in public/subjects, by course. */
export const art: Readonly<Record<CourseId, string>> = {
  de: "/subjects/de.svg",
  ma: "/subjects/ma.svg",
  en: "/subjects/en.svg",
  bi: "/subjects/bi.svg",
};

/** Mean points of the exams both teacher and parents have signed. */
export const confirmedAverage = (exams: ReadonlyArray<Exam>) => {
  const confirmed = exams.filter((exam) => exam.teacher && exam.parents);

  return confirmed.length === 0
    ? undefined
    : Math.round(confirmed.reduce((sum, exam) => sum + exam.points, 0) / confirmed.length);
};

/** Today's agenda. Lesson ids are course ids, so a lesson opens its course. */
export const today: ReadonlyArray<AgendaRow> = [
  {
    kind: "lesson",
    id: "ma",
    time: "08:00",
    subject: "Mathematik",
    slot: "blue",
    detail: "Hr. Brandt, R 2.14",
    phase: "past",
  },
  {
    kind: "lesson",
    id: "de",
    time: "09:45",
    subject: "Deutsch",
    slot: "rust",
    detail: "Fr. Albers, R 1.07",
    phase: "now",
    remaining: "Noch 34 Minuten",
  },
  {
    kind: "lesson",
    id: "en",
    time: "11:30",
    subject: "Englisch",
    slot: "violet",
    detail: "Hr. Wendt",
    phase: "later",
    change: "Vertretung",
  },
  { kind: "free", id: "free", time: "13:50" },
  {
    kind: "lesson",
    id: "bi",
    time: "15:15",
    subject: "Biologie",
    slot: "green",
    detail: "Hr. Yilmaz, R 0.12",
    phase: "later",
    change: "Entfall",
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

export const periods = ["08:00", "09:45", "11:30", "13:50", "15:15"] as const;

interface Week {
  readonly number: number;
  /** IGS alternates A and B weeks. */
  readonly kind: "A-Woche" | "B-Woche";
  readonly days: ReadonlyArray<WeekDay>;
  readonly today: string | undefined;
  readonly cells: ReadonlyArray<WeekCell>;
}

const day = (id: string, name: string, date: string): WeekDay => ({ id, name, date });

const subjects = {
  Mathe: ["blue", "BRA"],
  Bio: ["green", "YIL"],
  Deutsch: ["rust", "ALB"],
  Englisch: ["violet", "OKA"],
  Chemie: ["teal", "KOW"],
  Spanisch: ["magenta", "ORT"],
  PoWi: ["slate", "NGU"],
  "Gesch.": ["amber", "HAR"],
  Sport: ["red", "BER"],
  Seminar: ["olive", "LIN"],
} as const satisfies Record<string, readonly [Tokens.SubjectSlot, string]>;

type Subject = keyof typeof subjects;

/** One day's periods; `null` is a free period. */
const cells = (
  dayId: string,
  plan: ReadonlyArray<Subject | null>,
  changes: Readonly<
    Partial<Record<number, { change: "Vertretung" | "Entfall"; teacher?: string }>>
  > = {},
) =>
  plan.flatMap((subject, period): ReadonlyArray<WeekCell> => {
    if (subject === null) return [];
    const [slot, teacher] = subjects[subject];
    const change = changes[period];

    return [
      {
        id: `${dayId}-${String(period)}`,
        day: dayId,
        period,
        subject,
        slot,
        teacher: change?.teacher ?? teacher,
        change: change?.change,
      },
    ];
  });

export const weeks: ReadonlyArray<Week> = [
  {
    number: 43,
    kind: "A-Woche",
    days: [
      day("mo", "Mo", "19."),
      day("di", "Di", "20."),
      day("mi", "Mi", "21."),
      day("do", "Do", "22."),
      day("fr", "Fr", "23."),
    ],
    today: undefined,
    cells: [
      ...cells("mo", ["Mathe", "Englisch", "Deutsch", "Spanisch", null]),
      ...cells("di", ["Bio", "Chemie", "PoWi", "Sport", "Seminar"]),
      ...cells("mi", ["Mathe", "Deutsch", "Englisch", "Gesch.", null]),
      ...cells("do", ["Deutsch", "Spanisch", "Chemie", null, null]),
      ...cells("fr", ["Englisch", "Mathe", "Gesch.", "PoWi", "Sport"]),
    ],
  },
  {
    number: 44,
    kind: "B-Woche",
    days: [
      day("mo", "Mo", "26."),
      day("di", "Di", "27."),
      day("mi", "Mi", "28."),
      day("do", "Do", "29."),
      day("fr", "Fr", "30."),
    ],
    today: "mi",
    cells: [
      ...cells("mo", ["Mathe", "Englisch", "Deutsch", "Gesch.", "Seminar"]),
      ...cells("di", ["Bio", "Chemie", "PoWi", "Sport", null]),
      ...cells("mi", ["Mathe", "Deutsch", "Englisch", null, "Bio"], {
        2: { change: "Vertretung", teacher: "WEN" },
        4: { change: "Entfall" },
      }),
      ...cells("do", ["Deutsch", "Spanisch", "Chemie", "Bio", null]),
      ...cells("fr", ["Englisch", "Mathe", "Gesch.", "PoWi", null]),
    ],
  },
  {
    number: 45,
    kind: "A-Woche",
    days: [
      day("mo", "Mo", "2."),
      day("di", "Di", "3."),
      day("mi", "Mi", "4."),
      day("do", "Do", "5."),
      day("fr", "Fr", "6."),
    ],
    today: undefined,
    cells: [
      ...cells("mo", ["Mathe", "Englisch", "Deutsch", "Spanisch", null]),
      ...cells("di", ["Bio", "Chemie", "PoWi", "Sport", "Seminar"]),
      ...cells("mi", ["Mathe", "Deutsch", "Englisch", "Gesch.", null]),
      ...cells("do", ["Deutsch", "Spanisch", "Chemie", null, null]),
      ...cells("fr", ["Englisch", "Mathe", "Gesch.", "PoWi", "Sport"]),
    ],
  },
];

/** 10:31 is 46 minutes into the 09:45 period of 90 minutes. */
export const now = { period: 1, fraction: 46 / 90 };

/** The drifting strip: subject art from the app on its course colour. */
export const strip: ReadonlyArray<{
  readonly icon: string;
  readonly label: string;
  readonly slot: Tokens.SubjectSlot;
}> = [
  { icon: "ma", label: "Mathe", slot: "blue" },
  { icon: "de", label: "Deutsch", slot: "rust" },
  { icon: "en", label: "Englisch", slot: "violet" },
  { icon: "bi", label: "Biologie", slot: "green" },
  { icon: "ge", label: "Geschichte", slot: "amber" },
  { icon: "if", label: "Informatik", slot: "indigo" },
  { icon: "ch", label: "Chemie", slot: "teal" },
  { icon: "sp", label: "Sport", slot: "red" },
  { icon: "ku", label: "Kunst", slot: "magenta" },
  { icon: "ph", label: "Physik", slot: "cyan" },
  { icon: "mu", label: "Musik", slot: "olive" },
  { icon: "la", label: "Latein", slot: "slate" },
  { icon: "fr", label: "Französisch", slot: "rust" },
  { icon: "re", label: "Religion", slot: "blue" },
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
