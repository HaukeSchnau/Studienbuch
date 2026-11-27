import { CivilTime, Course, Homework } from "@stu/core";
import { Pickable } from "@stu/domain-ui/calendar/Pickable";
import type { Values } from "@stu/domain-ui/homework/HomeworkForm";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

// The add and edit sheet's rules: which courses it offers, when "Speichern" may run, and what an
// edit sends. The sheet decodes its values with these before it calls a mutator, so an invalid
// value never reaches the outbox.

export * as HomeworkInput from "./HomeworkInput.ts";

/**
 * What the student touched in the sheet, kept across a restart until "Speichern" or "Abbrechen".
 * Fields they didn't touch aren't kept, so they follow the homework as it is now (`values`).
 */
export const Draft = Schema.Struct({
  courseId: Schema.optionalKey(Schema.String),
  title: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  dueOn: Schema.optionalKey(CivilTime.PlainDate),
});

export type Draft = typeof Draft.Type;

const sameDraft = Schema.toEquivalence(Draft);

/**
 * Whether the draft `now` still holds just what a save submitted. Only then may the save drop it:
 * a field typed after the press would otherwise go without being saved.
 */
export const unchangedSince = (submitted: Draft, now: Draft): boolean => sameDraft(submitted, now);

const empty: Values = { courseId: null, title: "", description: "", dueOn: null };

/** A homework as the device holds it, which an edit starts from. */
export interface Current {
  readonly courseId: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly dueOn: CivilTime.PlainDate;
}

export const fromCurrent = (current: Current): Values => ({
  courseId: current.courseId,
  title: current.title,
  description: current.description ?? "",
  dueOn: current.dueOn,
});

/** What a new homework starts from, when "Hausaufgabe eintragen" on a lesson opened the sheet. */
export type Prefilled = Pick<Values, "courseId" | "dueOn">;

/**
 * The sheet's values: the homework as it is now, or a new one empty or `prefilled`, with what the
 * student touched over it.
 */
export const values = (
  current: Current | undefined,
  touched: Draft,
  prefilled?: Prefilled,
): Values => ({
  ...(current === undefined ? { ...empty, ...prefilled } : fromCurrent(current)),
  ...touched,
});

/** The add sheet's route params, as the router passes them on. */
export interface Params {
  readonly courseId?: string | ReadonlyArray<string> | undefined;
  readonly dueOn?: string | ReadonlyArray<string> | undefined;
}

const decodeParam = Schema.decodeUnknownOption(Schema.String);
const decodeDate = Schema.decodeUnknownOption(CivilTime.PlainDate);

/**
 * The draft the sheet keeps: an edit's under the homework's id, a new homework's under `new`, and
 * one that "Hausaufgabe eintragen" started under its course and due date, so each opens again as it
 * was left and a lesson's sheet never opens with what was picked for another lesson.
 */
export const draftKey = (id: string | undefined, params: Params): string =>
  id ??
  [
    "new",
    ...[params.courseId, params.dueOn].flatMap((param) => Option.toArray(decodeParam(param))),
  ].join("-");

/**
 * What a new homework starts from by the sheet's route params: the course while it is offered, and
 * the due date while the sheet offers it. A param that doesn't fit stays unpicked.
 */
export const prefilled = (params: Params, context: Omit<Context, "current">): Prefilled => ({
  courseId: Option.getOrNull(
    Option.filter(decodeParam(params.courseId), (id) => context.offered.includes(id)),
  ),
  dueOn: Option.getOrNull(
    Option.filter(decodeDate(params.dueOn), (date) =>
      Pickable.contains(dueDays(context.today, undefined), date),
    ),
  ),
});

/** An enrollment as the device holds it: the courses chosen in one term. */
export interface Chosen {
  readonly termId: string;
  readonly courseIds: ReadonlyArray<string>;
}

export interface Context {
  readonly today: CivilTime.PlainDate;
  /** The course ids from `Enrollment.chosenOn` for `today`. */
  readonly offered: ReadonlyArray<string>;
  /**
   * When editing, the homework as it is. Its own course and due date stay valid, so homework of a
   * dropped course or a passed date can still be edited.
   */
  readonly current?: Current | undefined;
}

/** Values that decode, ready for `homework.create` or `homework.update`. */
export interface Valid {
  readonly courseId: Course.Id;
  readonly title: Homework.Title;
  readonly description: Homework.Description | undefined;
  readonly dueOn: CivilTime.PlainDate;
}

/**
 * The due dates the sheet offers: today to a year ahead, and in an edit the homework's own due date,
 * which may have passed and stays pickable after the student tries another one.
 */
export const dueDays = (
  today: CivilTime.PlainDate,
  current: Current | undefined,
): Pickable.Days => ({
  range: Homework.dueDates(today),
  kept: current?.dueOn,
});

const decodeTitle = Schema.decodeUnknownOption(Homework.Title);
const decodeDescription = Schema.decodeUnknownOption(Homework.Description);
const decodeCourse = Schema.decodeUnknownOption(Course.Id);

/**
 * The values as the mutator's arguments, or `None` while one is missing or out of bounds: no Fach,
 * a blank title, a description too long, or a due date outside today to a year ahead.
 */
export const decode = (values: Values, context: Context): Option.Option<Valid> => {
  const { courseId, dueOn } = values;
  const { current } = context;

  if (courseId === null || dueOn === null) return Option.none();

  const courseAllowed = context.offered.includes(courseId) || current?.courseId === courseId;

  if (!courseAllowed || !Pickable.contains(dueDays(context.today, current), dueOn)) {
    return Option.none();
  }

  const description =
    values.description.trim() === ""
      ? Option.some(undefined)
      : decodeDescription(values.description);

  return Option.all({
    courseId: decodeCourse(courseId),
    title: decodeTitle(values.title),
    description,
    dueOn: Option.some(dueOn),
  });
};

type Changes = Omit<typeof Homework.update.args.Type, "notebook" | "id">;

/**
 * The fields an edit changes: those the student touched that differ from the homework as it is now.
 * `homework.update` patches what it is given, so a field another device changed while the sheet was
 * open keeps that change (ADR 0020). `null` removes the description.
 */
export const changes = (valid: Valid, current: Current, touched: Draft) => {
  const changed: { -readonly [Field in keyof Changes]?: Changes[Field] } = {};

  if (touched.courseId !== undefined && valid.courseId !== current.courseId) {
    changed.courseId = valid.courseId;
  }

  if (touched.title !== undefined && valid.title !== current.title) changed.title = valid.title;

  if (touched.description !== undefined && valid.description !== current.description) {
    changed.description = valid.description ?? null;
  }

  if (touched.dueOn !== undefined && CivilTime.order(valid.dueOn, current.dueOn) !== 0) {
    changed.dueOn = valid.dueOn;
  }

  return changed;
};
