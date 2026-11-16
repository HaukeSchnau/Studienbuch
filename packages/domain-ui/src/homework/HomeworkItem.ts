/**
 * Homework as the panel and its cards show it: the subject's name and mark, the title, the due date
 * in words and the state. The app builds items from its rows, and a page with demo rows can build
 * the same.
 */
import { HomeworkDates, type CivilTime, type Subject } from "@stu/core";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Order from "effect/Order";

import { DateText } from "../calendar/DateText.ts";
import { SubjectMark } from "../subject/SubjectMark.ts";
import { Due } from "./Due.ts";

export * as HomeworkItem from "./HomeworkItem.ts";

export interface Item {
  readonly id: string;
  /** The subject's name, such as "Mathematik", or the course's where the school named no subject. */
  readonly subject: string;
  readonly mark: SubjectMark.Mark;
  readonly title: string;
  /** "Bis morgen", "Überfällig seit Montag", "Erledigt am Dienstag" */
  readonly due: string;
  readonly overdue: boolean;
  readonly done: boolean;
  /** Greyed out: done, or open for more than a week past its due date. */
  readonly dimmed: boolean;
  /** Saved on this device and not yet with the server. */
  readonly waiting: boolean;
}

/** What the panel and the list say while the device has no key to the notebook. */
export const locked = {
  title: "Dein Notizbuch ist gesperrt",
  text: "Deine Hausaufgaben sind verschlüsselt. Entsperr dein Notizbuch, dann stehen sie hier.",
} as const;

/** A homework row with its id and what the device knows of its course. */
export interface Source extends HomeworkDates.Listed {
  readonly title: string;
  readonly course: string;
  readonly subject: Option.Option<Pick<Subject.Row, "name" | "shortName">>;
  readonly waiting: boolean;
}

/**
 * How a course shows on homework: by its subject's name and mark, or by its own name where the
 * school named no subject.
 */
export const named = (
  course: string,
  subject: Source["subject"],
): Pick<Item, "subject" | "mark"> => ({
  subject: Option.match(subject, { onNone: () => course, onSome: (s) => s.name }),
  mark: Option.match(subject, {
    onNone: () => SubjectMark.ofCourse(course),
    onSome: SubjectMark.ofSubject,
  }),
});

export const make = (source: Source, today: CivilTime.PlainDate): Item => ({
  id: source.id,
  ...named(source.course, source.subject),
  title: source.title,
  due: Due.label(source, today),
  overdue: HomeworkDates.isOverdue(source, today),
  done: source.doneOn !== undefined,
  dimmed: HomeworkDates.isDimmed(source, today),
  waiting: source.waiting,
});

/**
 * What the Übersicht's panel shows, in list order: all open homework, however late, and done
 * homework while it is in reach (`HomeworkDates.isInReach`).
 */
export const panel = (
  homework: ReadonlyArray<Source>,
  today: CivilTime.PlainDate,
): ReadonlyArray<Item> =>
  Arr.sort(
    homework.filter((each) => HomeworkDates.isInReach(each, today)),
    HomeworkDates.order,
  ).map((each) => make(each, today));

/** The full list's two parts, each in the order it shows. */
export interface Listing {
  readonly open: ReadonlyArray<Item>;
  readonly done: ReadonlyArray<Item>;
}

/**
 * The full list ("Alle"): every open homework by due date, then every done one with the latest due
 * date first, so what was just finished stays near the top of its part however long the year runs.
 */
export const list = (homework: ReadonlyArray<Source>, today: CivilTime.PlainDate): Listing => ({
  open: Arr.sort(
    homework.filter((each) => each.doneOn === undefined),
    HomeworkDates.order,
  ).map((each) => make(each, today)),
  done: Arr.sort(
    homework.filter((each) => each.doneOn !== undefined),
    Order.flip(HomeworkDates.order),
  ).map((each) => make(each, today)),
});

/** One homework's page: the card's facts, the text, and its dates written out. */
export interface Detail extends Item {
  readonly description: string | undefined;
  /** "Freitag, 20. November" */
  readonly dueDate: string;
  /** "Noch offen", "Überfällig seit Montag", or "Erledigt am Mittwoch, 28. Oktober". */
  readonly state: string;
}

export const detail = (
  source: Source & { readonly description: string | undefined },
  today: CivilTime.PlainDate,
): Detail => {
  const item = make(source, today);

  return {
    ...item,
    description: source.description,
    dueDate: DateText.full(source.dueOn, today),
    state:
      source.doneOn !== undefined
        ? `Erledigt am ${DateText.full(source.doneOn, today)}`
        : item.overdue
          ? item.due
          : "Noch offen",
  };
};
