import { type CivilTime, type Notebook, Timetable } from "@stu/core";
import { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import { AgendaItem } from "@stu/domain-ui/timetable/AgendaItem";
import * as Data from "effect/Data";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { HomeworkState } from "../homework/HomeworkState.ts";
import { TimetableState } from "./TimetableState.ts";

// What the lesson sheet shows, put together from the lesson and the notebook's homework, so its
// screen only draws.

export * as LessonState from "./LessonState.ts";

/** What "Hausaufgabe eintragen" opens the add sheet with. */
export interface Add {
  readonly courseId: string;
  /** The course's next lesson (`Timetable.nextLesson`), `None` while the school hasn't published one. */
  readonly dueOn: Option.Option<CivilTime.PlainDate>;
}

export type Sheet = Data.TaggedEnum<{
  /** Until the device has read the lesson and the notebook. */
  Reading: {};
  /** The device holds no such lesson of a chosen course, as after the school removed it. */
  Gone: {};
  Lesson: {
    /** At the school, which a tick takes as the day the homework was done. */
    readonly today: CivilTime.PlainDate;
    readonly detail: AgendaItem.Detail;
    /** The course's homework as the panel shows it. `undefined` while the notebook is locked. */
    readonly homework: ReadonlyArray<HomeworkItem.Item> | undefined;
    /** Whose homework the ticks change. `undefined` while the notebook is locked. */
    readonly notebook: Notebook.Id | undefined;
    /** `undefined` while the notebook is locked. */
    readonly add: Add | undefined;
  };
}>;

export const Sheet = Data.taggedEnum<Sheet>();

/** The sheet of the lesson `id`, again whenever the lesson, its course's lessons or homework change. */
export const sheet = Atom.family((accountId: string) =>
  Atom.family((id: string) =>
    Atom.make((get): Sheet => {
      const screen = get(HomeworkState.screen(accountId));
      const held = get(TimetableState.lesson(accountId)(id));

      if (Option.isNone(screen) || AsyncResult.isInitial(held)) return Sheet.Reading();

      const found = Option.flatten(AsyncResult.value(held));

      if (Option.isNone(found)) return Sheet.Gone();

      const { reading, lesson } = found.value;
      const { today, readable } = screen.value;
      const notebook = readable ? screen.value.reading : Option.none();
      const next = Timetable.nextLesson(reading.plan, lesson.courseId, lesson.date);

      return Sheet.Lesson({
        today,
        detail: AgendaItem.detail(lesson, reading.names, next, today),
        homework: Option.getOrUndefined(
          Option.map(notebook, (value) =>
            HomeworkItem.panel(
              value.homework.filter((each) => each.courseId === lesson.courseId),
              today,
            ),
          ),
        ),
        notebook: Option.getOrUndefined(Option.map(notebook, (value) => value.notebook)),
        add: Option.isSome(notebook)
          ? { courseId: lesson.courseId, dueOn: Option.map(next, (each) => each.date) }
          : undefined,
      });
    }),
  ),
);
