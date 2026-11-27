/**
 * A week as Meine Woche shows it: a column per day, the hours, a cell per lesson, the closures and
 * the days not published yet, and the words around them. The app builds it from its rows through
 * `Timetable.week`, and the landing page writes one directly.
 */
import { CivilTime, type HomeworkDates, Timetable } from "@stu/core";
import * as Option from "effect/Option";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";

import { DateText } from "../calendar/DateText.ts";
import { SubjectMark } from "../subject/SubjectMark.ts";
import { AgendaItem } from "./AgendaItem.ts";

export * as WeekItem from "./WeekItem.ts";

export interface Day {
  readonly id: string;
  /** "Mo" */
  readonly short: string;
  /** "Montag" */
  readonly long: string;
  /** "16." */
  readonly date: string;
  readonly today: boolean;
}

/** A lesson in the grid: its row on the Übersicht, placed in its day's column. */
export interface Cell extends AgendaItem.Lesson {
  /** Index into the week's `days`. */
  readonly day: number;
  /** As a lesson's `start` and `end` count them. */
  readonly start: number;
  readonly end: number;
  /** Lessons that overlap share the column, each as one of `lanes`, from 0 at the left. */
  readonly lane: number;
  readonly lanes: number;
  /** The subject as a phone's cell writes it: "Mathe", "Gesch.". */
  readonly short: string;
}

/** Days without lessons to draw, as one block across their columns, `from` and `to` included. */
export type Span =
  | {
      readonly kind: "closure";
      readonly from: number;
      readonly to: number;
      /** "Weihnachtsferien" */
      readonly name: string;
      /** "bis Sa, 9. Januar" */
      readonly until: string;
    }
  | { readonly kind: "unpublished"; readonly from: number; readonly to: number };

export interface Week {
  readonly days: ReadonlyArray<Day>;
  /**
   * From the earliest start to the latest end, with a label at each start. `undefined` without
   * lessons.
   */
  readonly hours:
    | { readonly start: number; readonly end: number; readonly labels: ReadonlyArray<number> }
    | undefined;
  readonly cells: ReadonlyArray<Cell>;
  readonly spans: ReadonlyArray<Span>;
  /** The line at now, in today's column while its lessons run. */
  readonly now?: { readonly day: number; readonly time: number } | undefined;
}

const sameDate = (a: CivilTime.PlainDate, b: CivilTime.PlainDate) => CivilTime.order(a, b) === 0;

/** What the week's columns lack lessons for, joined where neighbours say the same. */
const spans = (columns: ReadonlyArray<Timetable.Column<AgendaItem.Source>>) => {
  const all: Array<Span> = [];

  for (const [index, column] of columns.entries()) {
    const span = Timetable.Column.$match(column, {
      Open: (): Span | undefined => undefined,
      Closed: ({ name, until }): Span => ({
        kind: "closure",
        from: index,
        to: index,
        name,
        until: `bis ${DateText.medium(until)}`,
      }),
      Unpublished: (): Span => ({ kind: "unpublished", from: index, to: index }),
    });

    const last = all.at(-1);

    if (span === undefined) continue;

    if (
      last !== undefined &&
      last.to === index - 1 &&
      last.kind === span.kind &&
      (last.kind === "unpublished" ||
        (span.kind === "closure" && last.name === span.name && last.until === span.until))
    ) {
      all[all.length - 1] = { ...last, to: index };
    } else {
      all.push(span);
    }
  }

  return all;
};

/** The week `Timetable.week` picked, at `now`, with the notebook's `homework` (`AgendaItem.lesson`). */
export const week = (
  shown: Timetable.Week<AgendaItem.Source>,
  names: AgendaItem.Names,
  now: CivilTime.Moment,
  homework: ReadonlyArray<HomeworkDates.OfCourse>,
): Week => {
  const today = shown.columns.findIndex((column) => sameDate(column.date, now.date));
  const hours = Option.getOrUndefined(shown.hours);
  const todays = shown.columns[today];

  return {
    days: shown.columns.map((column, index) => ({
      id: CivilTime.format(column.date),
      short: DateText.shortWeekday(column.date),
      long: DateText.weekday(column.date),
      date: `${String(column.date.day)}.`,
      today: index === today,
    })),
    hours:
      hours === undefined
        ? undefined
        : { start: hours.start, end: hours.end, labels: hours.starts },
    cells: shown.columns.flatMap((column, day) =>
      column._tag === "Open"
        ? column.lessons.map(({ lesson, lane, lanes }): Cell => ({
            ...AgendaItem.lesson(lesson, names, now, homework),
            day,
            start: lesson.start,
            end: lesson.end,
            lane,
            lanes,
            short: Option.match(lesson.subject, {
              onNone: () => lesson.course,
              onSome: SubjectMark.short,
            }),
          }))
        : [],
    ),
    spans: spans(shown.columns),
    now:
      todays?._tag === "Open" &&
      hours !== undefined &&
      now.time >= hours.start &&
      now.time <= hours.end
        ? { day: today, time: now.time }
        : undefined,
  };
};

/** The hero's line under "Meine Woche": "16.–20. November", to Saturday when it shows. */
export const heading = (monday: CivilTime.PlainDate, days: number): string =>
  DateText.span(monday, CivilTime.addDays(monday, days - 1));

/** "A" as "A-Woche"; a longer label as the school writes it. */
const labelled = (label: string) => (label.length <= 2 ? `${label}-Woche` : label);

/** The hero's chips: "KW 47", and the school's label for the week, such as "A-Woche". */
export const chips = (
  monday: CivilTime.PlainDate,
  label: string | undefined,
): ReadonlyArray<string> => [
  `KW ${String(PlainDateFns.weekOfYear(monday))}`,
  ...(label === undefined ? [] : [labelled(label)]),
];

/** A day of the week as the day list shows it at large text sizes: the Übersicht's card. */
export interface DayList {
  readonly items: ReadonlyArray<AgendaItem.Item>;
  readonly notice?: AgendaItem.Notice;
}

/** The day list of the week's column `index`, with the notebook's `homework`. */
export const day = (
  shown: Timetable.Week<AgendaItem.Source>,
  index: number,
  names: AgendaItem.Names,
  now: CivilTime.Moment,
  homework: ReadonlyArray<HomeworkDates.OfCourse>,
): DayList => {
  const column = shown.columns[index];

  if (column === undefined) return { items: [] };

  return Timetable.Column.$match(column, {
    Open: ({ lessons }) =>
      lessons.length === 0
        ? { items: [], notice: { lines: ["Kein Unterricht."] } }
        : {
            items: AgendaItem.items(
              Timetable.day(
                lessons.map(({ lesson }) => lesson),
                shown.published,
              ),
              names,
              now,
              homework,
            ),
          },
    Closed: ({ name, until }) => ({
      items: [],
      notice: { title: name, lines: [`bis ${DateText.medium(until)}`] },
    }),
    Unpublished: ({ date }) => ({
      items: [],
      notice: AgendaItem.unpublished(DateText.weekday(date)),
    }),
  });
};
