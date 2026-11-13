/**
 * Homework as the panel and its cards show it: the subject's name and mark, the title, the due date
 * in words and the state. The app builds items from its rows, and a page with demo rows can build
 * the same.
 */
import { HomeworkDates, type CivilTime, type Subject } from "@stu/core";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

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

/** A homework row with its id and what the device knows of its course. */
export interface Source extends HomeworkDates.Listed {
  readonly title: string;
  readonly course: string;
  readonly subject: Option.Option<Pick<Subject.Row, "name" | "shortName">>;
  readonly waiting: boolean;
}

export const make = (source: Source, today: CivilTime.PlainDate): Item => ({
  id: source.id,
  subject: Option.match(source.subject, { onNone: () => source.course, onSome: (s) => s.name }),
  mark: Option.match(source.subject, {
    onNone: () => SubjectMark.ofCourse(source.course),
    onSome: SubjectMark.ofSubject,
  }),
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
