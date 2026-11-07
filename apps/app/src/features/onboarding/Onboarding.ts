import {
  type Course,
  CourseOffering,
  type Enrollment,
  type Notebook,
  type School,
  type SchoolClass,
  type Subject,
  type Term,
} from "@stu/core";
import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as Option from "effect/Option";

// The answers of the first start after sign-up, in the Flutter app's order: name, Jahrgang and
// "volljährig", then Klasse and the elective courses. The name and "volljährig" go to the encrypted
// profile (`notebookProfile.set`), Jahrgang, Klasse and courses to the readable course choice
// (`enrollment.set`), whose checks the server runs again.

export * as Onboarding from "./Onboarding.ts";

/** What the device holds of the student's notebook and school, read in one go. */
export interface Snapshot {
  readonly id: Notebook.Id;
  readonly schoolName: string;
  readonly profile: {
    readonly displayName?: string | undefined;
    readonly adult?: boolean | undefined;
  };
  /** Today's term, when today is in one, with everything that can be chosen in it. */
  readonly term: Option.Option<TermChoices>;
  /** The server's latest refusal of a course choice, which the course step shows. */
  readonly refused: Option.Option<Refused>;
}

/** A refused `enrollment.set`, to show and then dismiss. */
export interface Refused {
  readonly clientId: string;
  readonly mutationId: number;
  readonly reason: { readonly _tag: string };
}

/**
 * The device before its first sync (`Waiting`), an account no school admitted yet (`NoSchool`),
 * or the notebook with its school's rows.
 */
export type Reading = Data.TaggedEnum<{
  Waiting: {};
  NoSchool: {};
  Ready: { readonly snapshot: Snapshot };
}>;

export const Reading = Data.taggedEnum<Reading>();

/** Where the first start stands: "done" lets the student into the app. */
export type Step = "waiting" | "who" | "courses" | "done";

/**
 * The step the student is on. The name comes first. Then a course choice for today's term is
 * required whenever the term offers courses to some grade, and one the server refused brings the
 * course step back.
 */
export const next = (reading: Reading): Step => {
  if (reading._tag === "Waiting") return "waiting";

  if (reading._tag === "NoSchool") return "done";

  const { profile, term, refused } = reading.snapshot;

  if (profile.displayName === undefined) return "who";

  if (Option.isSome(refused)) return "courses";

  return Option.exists(
    term,
    (choices) => gradeLevels(choices).length > 0 && Option.isNone(choices.enrollment),
  )
    ? "courses"
    : "done";
};

export interface TermChoices {
  readonly id: Term.Id;
  readonly classes: ReadonlyArray<{ readonly id: SchoolClass.Id } & SchoolClass.Row>;
  readonly offerings: ReadonlyArray<CourseOffering.Row>;
  readonly courses: ReadonlyMap<string, Course.Row>;
  readonly subjects: ReadonlyMap<string, Subject.Row>;
  /** The choice made for this term already, as admission with a code's grade level makes it. */
  readonly enrollment: Option.Option<Enrollment.Row>;
}

/** The grade levels the term offers courses to or has classes in, lowest first. */
export const gradeLevels = (term: TermChoices): ReadonlyArray<School.GradeLevel> =>
  Arr.dedupe([
    ...term.offerings.flatMap((offering) => offering.gradeLevels),
    ...term.classes.map((each) => each.gradeLevel),
  ]).sort((a, b) => a - b);

/** The classes of a grade level, by name. `enrollment.set` requires one when there are any. */
export const classesOf = (term: TermChoices, gradeLevel: School.GradeLevel) =>
  term.classes
    .filter((each) => each.gradeLevel === gradeLevel)
    .sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));

/** One course the student may choose or leave, shown as a subject tile. */
export interface Elective {
  readonly courseId: Course.Id;
  readonly groupKey: string;
  readonly course: string;
  readonly subject: Option.Option<Subject.Row>;
}

const offered = (term: TermChoices, chooser: CourseOffering.Chooser) =>
  term.offerings.filter((offering) => CourseOffering.isFor(offering, chooser));

/** The elective courses open to `chooser`, by subject. Required courses never show. */
export const electives = (
  term: TermChoices,
  chooser: CourseOffering.Chooser,
): ReadonlyArray<Elective> =>
  offered(term, chooser)
    .flatMap((offering) =>
      offering.groupKey === undefined
        ? []
        : [
            {
              courseId: offering.courseId,
              groupKey: offering.groupKey,
              course: term.courses.get(offering.courseId)?.name ?? offering.courseId,
              subject: Option.fromNullishOr(
                term.subjects.get(term.courses.get(offering.courseId)?.subjectId ?? ""),
              ),
            },
          ],
    )
    .sort((a, b) => label(a).localeCompare(label(b), "de"));

/** The tile's title: the subject, or the course where the school named none. */
export const label = (elective: Elective) =>
  Option.match(elective.subject, { onNone: () => elective.course, onSome: (s) => s.name });

/**
 * Chooses or leaves one elective. Choosing it leaves the others of its group, because a group
 * allows one (`Enrollment.TwoInOneGroup`).
 */
export const toggle = (
  chosen: ReadonlySet<Course.Id>,
  elective: Elective,
  all: ReadonlyArray<Elective>,
): ReadonlySet<Course.Id> => {
  if (chosen.has(elective.courseId)) {
    return new Set([...chosen].filter((id) => id !== elective.courseId));
  }

  const sameGroup = new Set(
    all.flatMap((each) => (each.groupKey === elective.groupKey ? [each.courseId] : [])),
  );

  return new Set([...[...chosen].filter((id) => !sameGroup.has(id)), elective.courseId]);
};

/** The electives an earlier choice for this term holds, as the tiles start. */
export const startingChoice = (
  term: TermChoices,
  chooser: CourseOffering.Chooser,
): ReadonlySet<Course.Id> => {
  const open = new Set(electives(term, chooser).map((each) => each.courseId));

  return new Set(
    Option.match(term.enrollment, {
      onNone: () => [],
      onSome: (enrollment) => enrollment.courseIds.filter((id) => open.has(id)),
    }),
  );
};

/**
 * The course choice to write: every required course open to `chooser` and the chosen electives
 * still open to it, sorted as `enrollment.set` keeps them.
 */
export const courseIds = (
  term: TermChoices,
  chooser: CourseOffering.Chooser,
  chosen: ReadonlySet<Course.Id>,
): ReadonlyArray<Course.Id> => {
  const open = offered(term, chooser);
  const required = open.filter((offering) => offering.groupKey === undefined);
  const electiveIds = new Set(open.flatMap((o) => (o.groupKey === undefined ? [] : [o.courseId])));

  return Arr.dedupe([
    ...required.map((offering) => offering.courseId),
    ...[...chosen].filter((id) => electiveIds.has(id)),
  ]).sort();
};
