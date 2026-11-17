import {
  type Course,
  type CourseOffering,
  Enrollment,
  type Notebook,
  type School,
  type SchoolClass,
  type Subject,
  type Term,
} from "@stu/core";
import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";

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

/**
 * The name the home greets with: `None` only while the first reading loads. A reading that failed
 * greets without a name, as the onboarding gate lets the student in then.
 */
export const greeting = (reading: AsyncResult.AsyncResult<Reading, unknown>) =>
  AsyncResult.isInitial(reading)
    ? Option.none()
    : Option.some(
        Option.flatMap(AsyncResult.value(reading), (now) =>
          now._tag === "Ready"
            ? Option.fromNullishOr(now.snapshot.profile.displayName)
            : Option.none(),
        ),
      );

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

/**
 * Who chooses in the term: the grade level, and the class answered for it if that is one of its
 * classes. A class answered for another grade level, such as the earlier choice's, doesn't count.
 */
export const chooser = (
  term: TermChoices,
  gradeLevel: School.GradeLevel,
  classId: Option.Option<SchoolClass.Id>,
): CourseOffering.Chooser => ({
  termId: term.id,
  gradeLevel,
  classId: Option.getOrUndefined(
    Option.filter(classId, (id) => classesOf(term, gradeLevel).some((each) => each.id === id)),
  ),
});

/** Whether the chooser's class is answered, as `enrollment.set` requires. */
export const classAnswered = (term: TermChoices, chooser: CourseOffering.Chooser) =>
  Enrollment.classFits(classesOf(term, chooser.gradeLevel), chooser.classId);

/** One course the student may choose or leave, shown as a subject tile. */
export interface Elective {
  readonly courseId: Course.Id;
  readonly course: string;
  readonly subject: Option.Option<Subject.Row>;
}

/** An elective group of `Enrollment.groups`, its courses as tiles by subject. */
export interface ElectiveGroup {
  readonly key: string;
  readonly required: boolean;
  readonly electives: ReadonlyArray<Elective>;
}

/** The tile's title: the subject, or the course where the school named none. */
export const label = (elective: Elective) =>
  Option.match(elective.subject, { onNone: () => elective.course, onSome: (s) => s.name });

const byLabel = (a: Elective, b: Elective) => label(a).localeCompare(label(b), "de");

/** A group's name as one choice, such as "Kunst oder Musik". */
export const groupLabel = (group: Pick<ElectiveGroup, "electives">) => {
  const labels = group.electives.map(label);
  const last = labels.pop() ?? "";

  return labels.length === 0 ? last : `${labels.join(", ")} oder ${last}`;
};

/** The elective groups open to `chooser`, by name. Required courses never show. */
export const electiveGroups = (
  term: TermChoices,
  chooser: CourseOffering.Chooser,
): ReadonlyArray<ElectiveGroup> =>
  Enrollment.groups(term.offerings, chooser)
    .map(({ key, required, courseIds }) => ({
      key,
      required,
      electives: courseIds
        .map((courseId) => {
          const course = term.courses.get(courseId);

          return {
            courseId,
            course: course?.name ?? courseId,
            subject: Option.fromNullishOr(term.subjects.get(course?.subjectId ?? "")),
          };
        })
        .sort(byLabel),
    }))
    .sort((a, b) => groupLabel(a).localeCompare(groupLabel(b), "de"));

/**
 * Presses one elective's tile: it leaves the others of its group, because a group allows one
 * (`Enrollment.TwoInOneGroup`). Pressed again it stays in a required group and leaves otherwise.
 */
export const choose = (
  chosen: ReadonlySet<Course.Id>,
  group: ElectiveGroup,
  elective: Elective,
): ReadonlySet<Course.Id> => {
  const others = [...chosen].filter((id) => !group.electives.some((each) => each.courseId === id));

  if (!chosen.has(elective.courseId)) return new Set([...others, elective.courseId]);

  return group.required ? chosen : new Set(others);
};

/** The electives an earlier choice for this term holds, as the tiles start. */
export const startingChoice = (
  term: TermChoices,
  chooser: CourseOffering.Chooser,
): ReadonlySet<Course.Id> => {
  const open = new Set(
    electiveGroups(term, chooser).flatMap((group) => group.electives.map((each) => each.courseId)),
  );

  return new Set(
    Option.match(term.enrollment, {
      onNone: () => [],
      onSome: (enrollment) => enrollment.courseIds.filter((id) => open.has(id)),
    }),
  );
};
