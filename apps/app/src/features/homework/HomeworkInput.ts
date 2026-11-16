import { CivilTime, Course, Homework, Term } from "@stu/core";
import type { Tx } from "@stu/sync";
import type { Values } from "@stu/domain-ui/homework/HomeworkForm";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

// The add and edit sheet's rules: which courses it offers, when "Speichern" may run, and what an
// edit sends. The sheet decodes its values with these before it calls a mutator, so an invalid
// value never reaches the outbox.

export * as HomeworkInput from "./HomeworkInput.ts";

/** The sheet's values as a draft keeps them across a restart. */
export const Draft = Schema.Struct({
  courseId: Schema.NullOr(Schema.String),
  title: Schema.String,
  description: Schema.String,
  dueOn: Schema.NullOr(CivilTime.PlainDate),
});

export type Draft = typeof Draft.Type;

export const empty: Draft = { courseId: null, title: "", description: "", dueOn: null };

/** A homework as the device holds it, which an edit starts from. */
export interface Current {
  readonly courseId: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly dueOn: CivilTime.PlainDate;
}

export const fromCurrent = (current: Current): Draft => ({
  courseId: current.courseId,
  title: current.title,
  description: current.description ?? "",
  dueOn: current.dueOn,
});

/** An enrollment as the device holds it: the courses chosen in one term. */
export interface Chosen {
  readonly termId: string;
  readonly courseIds: ReadonlyArray<string>;
}

/**
 * The courses the sheet offers as Fach: those chosen for the term `today` falls in. Between terms,
 * or before the school's terms arrived, every chosen course, since `homework.create` accepts any.
 */
export const offered = (
  enrollments: ReadonlyArray<Chosen>,
  terms: ReadonlyArray<Tx.Entry<Term.Row>>,
  today: CivilTime.PlainDate,
): ReadonlyArray<string> =>
  Option.match(
    Option.flatMap(Term.containing(terms, today), (term) =>
      Arr.findFirst(enrollments, (enrollment) => enrollment.termId === term.id),
    ),
    {
      onNone: () => Arr.dedupe(enrollments.flatMap((enrollment) => enrollment.courseIds)),
      onSome: (enrollment) => enrollment.courseIds,
    },
  );

export interface Context {
  readonly today: CivilTime.PlainDate;
  /** The course ids from `offered`. */
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

  const dueAllowed =
    CivilTime.contains(Homework.dueDates(context.today), dueOn) ||
    (current !== undefined && CivilTime.order(current.dueOn, dueOn) === 0);

  if (!courseAllowed || !dueAllowed) return Option.none();

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
 * The fields an edit changes, and only those: `homework.update` patches what it is given, so two
 * devices editing different fields both keep their edit (ADR 0020). `null` removes the description.
 */
export const changes = (valid: Valid, current: Current) => {
  const changed: { -readonly [Field in keyof Changes]?: Changes[Field] } = {};

  if (valid.courseId !== current.courseId) changed.courseId = valid.courseId;

  if (valid.title !== current.title) changed.title = valid.title;

  if (valid.description !== current.description) changed.description = valid.description ?? null;

  if (CivilTime.order(valid.dueOn, current.dueOn) !== 0) changed.dueOn = valid.dueOn;

  return changed;
};
