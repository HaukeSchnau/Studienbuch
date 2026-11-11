/**
 * Homework as a card or a row shows it: its subject's look, the title, the due date in words and
 * its state. The app builds items from its rows, the landing page from demo rows, so both show the
 * same thing.
 */
import { HomeworkDates, type CivilTime, type Course, type Subject } from "@stu/core";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import { SubjectLook } from "../subject/SubjectLook.ts";
import { Due } from "./Due.ts";

export * as HomeworkItem from "./HomeworkItem.ts";

export interface Item {
  readonly id: string;
  /** The subject's name, such as "Mathematik", or the course's when the school named no subject. */
  readonly subject: string;
  readonly look: SubjectLook.Look;
  readonly title: string;
  /** "Bis morgen", "Überfällig seit Montag", "Erledigt am Dienstag" */
  readonly due: string;
  readonly overdue: boolean;
  readonly done: boolean;
  /** Done, or open for more than a week past its due date. Legacy greyed these out. */
  readonly dimmed: boolean;
}

export interface Source extends HomeworkDates.Listed {
  readonly title: string;
  /** The course as the school names it. `None` when the device doesn't hold the course's row. */
  readonly course: Option.Option<Pick<Course.Row, "name">>;
  readonly subject: Option.Option<Pick<Subject.Row, "name" | "shortName">>;
}

export const make = (source: Source, today: CivilTime.PlainDate): Item => {
  const course = Option.map(source.course, ({ name }) => name);

  return {
    id: source.id,
    subject: Option.match(source.subject, {
      onNone: () => Option.getOrElse(course, () => "Kurs"),
      onSome: ({ name }) => name,
    }),
    look: Option.match(source.subject, {
      onNone: () => SubjectLook.ofCourse(Option.getOrElse(course, () => "")),
      onSome: SubjectLook.ofSubject,
    }),
    title: source.title,
    due: Due.label(source, today),
    overdue: HomeworkDates.isOverdue(source, today),
    done: source.doneOn !== undefined,
    dimmed: HomeworkDates.isDimmed(source, today),
  };
};

/**
 * Whether the Übersicht's panel shows the homework. Open homework always, however late, because
 * it is still to do. Done homework until a week after its due date, the same seven days after which
 * `HomeworkDates.isDimmed` greys open homework, so a ticked card stays in reach to undo (D72).
 */
export const inPanel = (homework: HomeworkDates.Listed, today: CivilTime.PlainDate): boolean =>
  homework.doneOn === undefined ||
  !HomeworkDates.isDimmed({ id: homework.id, dueOn: homework.dueOn }, today);

/** The panel's cards: what `inPanel` keeps, in `HomeworkDates.order`. */
export const panel = (
  homework: ReadonlyArray<Source>,
  today: CivilTime.PlainDate,
): ReadonlyArray<Item> =>
  Arr.sort(
    homework.filter((each) => inPanel(each, today)),
    HomeworkDates.order,
  ).map((each) => make(each, today));
