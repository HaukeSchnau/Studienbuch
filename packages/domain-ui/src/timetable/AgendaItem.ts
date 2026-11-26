/**
 * A day's lessons as the Übersicht's card shows them, with the words around them: the hero's line,
 * a change's note, the free periods, what a closure says, and the Stand; and one lesson as its sheet
 * shows it. The app builds them from its rows through `Timetable`, and a page with demo data builds
 * the items directly.
 */
import { CivilTime, HomeworkDates, type Subject, Timetable } from "@stu/core";
import * as Option from "effect/Option";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";

import { DateText } from "../calendar/DateText.ts";
import { SubjectMark } from "../subject/SubjectMark.ts";

export * as AgendaItem from "./AgendaItem.ts";

/** A teacher or a room, with what it was before a change. */
export interface Named {
  /** "Vogt", or "" when the change left none. */
  readonly now: string;
  /** "Brandt", struck through beside `now`. */
  readonly was?: string | undefined;
}

/** "Voss statt Brandt", as a screen reader says what a struck name shows. */
export const spoken = (named: Named): string =>
  named.was === undefined ? named.now : `${named.now || "niemand"} statt ${named.was}`;

export type Phase = "past" | "now" | "later";

export type Item =
  | {
      readonly kind: "lesson";
      readonly id: string;
      /** "08:00–09:30" */
      readonly time: string;
      readonly subject: string;
      readonly mark: SubjectMark.Mark;
      readonly teacher?: Named | undefined;
      readonly room?: Named | undefined;
      readonly phase: Phase;
      /** On the lesson running now: "Noch 50 Minuten". */
      readonly remaining?: string | undefined;
      /** The yellow note of a change: "Vertretung", "Raumänderung". */
      readonly note?: string | undefined;
      /** The name is struck through, with this beside it: "Entfall", "Freisetzung". */
      readonly off?: string | undefined;
      /** "Hausaufgabe offen": the course has open homework due that day, and the lesson is ahead. */
      readonly homework?: boolean | undefined;
    }
  | { readonly kind: "free"; readonly id: string; readonly time: string };

/** A message in place of the rows, such as when school resumes after the holidays. */
export interface Notice {
  readonly title?: string | undefined;
  readonly lines: ReadonlyArray<string>;
}

/** What the Übersicht shows of the timetable. */
export interface Agenda {
  /** The hero's line under the greeting: "Das steht heute an:" */
  readonly heading: string;
  /** `undefined` hides the card, as at a school without a timetable. */
  readonly card: { readonly items: ReadonlyArray<Item>; readonly notice?: Notice } | undefined;
}

/** A lesson row with its course as the device names it. */
export interface Source extends Timetable.Timed {
  readonly id: string;
  readonly course: string;
  readonly subject: Option.Option<Pick<Subject.Row, "name" | "shortName">>;
}

/** Teachers' and rooms' names by id: a teacher's `displayName`, else the short name. */
export interface Names {
  readonly teachers: ReadonlyMap<string, string>;
  readonly rooms: ReadonlyMap<string, string>;
}

const notes: Readonly<Record<Timetable.NoteKind, string>> = {
  Substitution: "Vertretung",
  Supervised: "Betreuung",
  RoomChange: "Raumänderung",
  Moved: "Verlegt",
  Added: "Zusätzlich",
  Other: "Geändert",
};

/** What a change is called on the lesson, as the note or beside the struck name. */
export const changeText = Timetable.Change.$match({
  Off: ({ kind }) => (kind === "Cancelled" ? "Entfall" : "Freisetzung"),
  Note: ({ kind, text }) => text ?? notes[kind],
});

const range = (start: number, end: number) => `${DateText.time(start)}–${DateText.time(end)}`;

const named = (
  ids: ReadonlyArray<string>,
  previous: ReadonlyArray<string>,
  names: ReadonlyMap<string, string>,
): Named | undefined => {
  const list = (each: ReadonlyArray<string>) =>
    each.flatMap((id) => Option.toArray(Option.fromNullishOr(names.get(id)))).join(", ");

  const now = list(ids);
  const was = list(previous);

  if (now === "" && was === "") return undefined;

  return was === "" ? { now } : { now, was };
};

const phases: Readonly<Record<Timetable.Phase, Phase>> = {
  Over: "past",
  Running: "now",
  Later: "later",
};

/** "Noch 50 Minuten", "Noch 1 Minute" */
const remaining = (minutes: number) =>
  `Noch ${String(minutes)} ${minutes === 1 ? "Minute" : "Minuten"}`;

/** What a lesson's row and its sheet both show: subject, teacher, room, and its change. */
const facts = (source: Source, names: Names) => {
  const change = Timetable.change(source);

  return {
    id: source.id,
    ...SubjectMark.named(source.course, source.subject),
    teacher: named(source.teacherIds, source.change?.previousTeacherIds ?? [], names.teachers),
    room: named(source.roomIds, source.change?.previousRoomIds ?? [], names.rooms),
    /** The change that gets a note, which each view words. */
    note: Option.filter(change, Timetable.Change.$is("Note")),
    off: Option.getOrUndefined(
      Option.filter(change, Timetable.Change.$is("Off")).pipe(Option.map(changeText)),
    ),
  };
};

/**
 * One lesson's row at `now`, with the notebook's `homework` as the device can read it: none while
 * the notebook is locked.
 */
export const lesson = (
  source: Source,
  names: Names,
  now: CivilTime.Moment,
  homework: ReadonlyArray<HomeworkDates.OfCourse>,
): Item => {
  const phase = Timetable.phase(source, now);
  const shared = facts(source, names);

  return {
    kind: "lesson",
    ...shared,
    time: range(source.start, source.end),
    phase: phases[phase],
    remaining: phase === "Running" ? remaining(Timetable.minutesLeft(source, now)) : undefined,
    note: Option.getOrUndefined(Option.map(shared.note, changeText)),
    homework: phase !== "Over" && HomeworkDates.isOpenFor(homework, source.courseId, source.date),
  };
};

/** One lesson as its sheet shows it. */
export interface Detail {
  readonly id: string;
  readonly subject: string;
  readonly mark: SubjectMark.Mark;
  /** "Mittwoch, 18. November · 09:50–11:20" */
  readonly when: string;
  readonly teacher?: Named | undefined;
  readonly room?: Named | undefined;
  /** The yellow note with what it changed: "Vertretung: Voss statt Brandt". */
  readonly note?: string | undefined;
  /** The name is struck through, with this beside it: "Entfall", "Freisetzung". */
  readonly off?: string | undefined;
  /** The school's stock phrase about the change, where the note doesn't say it already. */
  readonly phrase?: string | undefined;
  /** Under "Hausaufgabe eintragen": "Fällig zur nächsten Stunde: Fr, 20.11., 08:00". */
  readonly due: string;
}

/** ": Voss statt Brandt", for a note whose change replaced a teacher or a room. */
const instead = (swapped: Named | undefined) =>
  swapped?.was === undefined || swapped.now === "" ? "" : `: ${swapped.now} statt ${swapped.was}`;

/** One lesson's sheet, with the course's `next` lesson (`Timetable.nextLesson`), today being `today`. */
export const detail = (
  source: Source,
  names: Names,
  next: Option.Option<Pick<Timetable.Timed, "date" | "start">>,
  today: CivilTime.PlainDate,
): Detail => {
  const shared = facts(source, names);
  const { teacher, room, off } = shared;
  const phrase = source.change?.text;

  const note = Option.map(
    shared.note,
    (change) =>
      changeText(change) +
      (change.kind === "RoomChange"
        ? instead(room)
        : change.kind === "Substitution" || change.kind === "Supervised"
          ? instead(teacher)
          : ""),
  );

  return {
    ...shared,
    when: `${DateText.full(source.date, today)} · ${range(source.start, source.end)}`,
    note: Option.getOrUndefined(note),
    // Not where the note or the struck name says it already, as `Other` does.
    phrase:
      phrase === off || Option.exists(shared.note, (change) => change.text === phrase)
        ? undefined
        : phrase,
    due: Option.match(next, {
      onNone: () => "Die nächste Stunde steht noch nicht im Plan.",
      onSome: (lesson) =>
        `Fällig zur nächsten Stunde: ${DateText.short(lesson.date, today)}, ${DateText.time(lesson.start)}`,
    }),
  };
};

/** "heute", "morgen", "Montag" within the week, else "Mo, 11.1.". */
const dayWord = (date: CivilTime.PlainDate, today: CivilTime.PlainDate) => {
  const days = PlainDateFns.diffDays(today, date);

  if (days === 0) return "heute";

  if (days === 1) return "morgen";

  return days < 7 ? DateText.weekday(date) : DateText.short(date, today);
};

/** "am Montag", but "heute" and "morgen" alone. */
const onDay = (date: CivilTime.PlainDate, today: CivilTime.PlainDate) => {
  const word = dayWord(date, today);

  return word === "heute" || word === "morgen" ? word : `am ${word}`;
};

const holidays = /ferien$/iu;

/** What the Übersicht shows of what `Timetable.shown` picked, at `now`, with `lesson`'s homework. */
export const agenda = (
  shown: Timetable.Shown<Source>,
  names: Names,
  now: CivilTime.Moment,
  homework: ReadonlyArray<HomeworkDates.OfCourse>,
): Agenda =>
  Timetable.Shown.$match(shown, {
    Day: ({ date, rows }) => ({
      heading: `Das steht ${onDay(date, now.date)} an:`,
      card: {
        items: rows.map(
          Timetable.Row.$match({
            Lesson: ({ lesson: each }) => lesson(each, names, now, homework),
            Free: ({ start, end }): Item => ({
              kind: "free",
              id: `free-${String(start)}`,
              time: range(start, end),
            }),
          }),
        ),
      },
    }),
    Unpublished: ({ date }) => {
      const word = dayWord(date, now.date);

      return {
        heading: `Das steht ${onDay(date, now.date)} an:`,
        card: {
          items: [],
          notice: { lines: [`Für ${word} ist noch nichts veröffentlicht.`] },
        },
      };
    },
    Closed: ({ name, until, resumes, first }) => {
      const ferien = holidays.test(name);

      const title =
        CivilTime.order(until, now.date) > 0
          ? `${ferien ? "Ferien" : "Frei"} bis ${DateText.long(until)}`
          : undefined;

      const back =
        PlainDateFns.diffDays(now.date, resumes) === 1 ? "morgen" : `am ${DateText.long(resumes)}`;

      const firstLesson = Option.map(first, (each) => {
        const { subject } = SubjectMark.named(each.course, each.subject);
        const room = named(each.roomIds, [], names.rooms)?.now ?? "";

        return `Um ${DateText.time(each.start)} mit ${subject}${room === "" ? "" : ` in ${room}`}.`;
      });

      return {
        heading: ferien ? `Schöne ${name}!` : `Heute frei: ${name}`,
        card: {
          items: [],
          notice: { title, lines: [`Weiter geht's ${back}.`, ...Option.toArray(firstLesson)] },
        },
      };
    },
    None: () => ({ heading: DateText.long(now.date), card: undefined }),
  });

/** The Stand in the card's foot, once it is old (`Timetable.staleSince`). */
export interface Stand {
  /** "Stand: heute, 07:40" */
  readonly title: string;
  readonly hint: string;
}

/** The Stand read at `read`, today being `today`, and whether the device is offline. */
export const stand = (
  read: CivilTime.Moment,
  today: CivilTime.PlainDate,
  offline: boolean,
): Stand => {
  const days = PlainDateFns.diffDays(read.date, today);
  const day = days === 0 ? "heute" : days === 1 ? "gestern" : DateText.short(read.date, today);

  return {
    title: `Stand: ${day}, ${DateText.time(read.time)}`,
    hint: offline
      ? "Neuere Vertretungen siehst du, sobald du wieder online bist."
      : "Neuere Vertretungen fehlen vielleicht.",
  };
};
