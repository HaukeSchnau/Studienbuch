/**
 * Kurswahl: the courses a student takes in one term. It stays readable, because the server derives
 * course memberships from it, so `enrollment.set` is the one mutator the server runs again and
 * may refuse.
 */
import { Sync, Tx } from "@stu/sync";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Course } from "../school/Course.ts";
import { CourseOffering } from "../school/CourseOffering.ts";
import { School } from "../school/School.ts";
import { SchoolClass } from "../school/SchoolClass.ts";
import { Term } from "../school/Term.ts";
import { Notebook } from "./Notebook.ts";

export * as Enrollment from "./Enrollment.ts";

/**
 * In the notebook space, one per term under the term's id, so two offline devices that choose
 * courses for one term write the same row.
 */
export const Row = Sync.table("Enrollment", {
  class: "readable",
  fields: {
    termId: Term.Id,
    /** Pins the grading scale for the term, even when the student later repeats a year. */
    gradeLevel: School.GradeLevel,
    classId: Schema.optional(SchoolClass.Id),
    /** Sorted, without duplicates. */
    courseIds: Schema.Array(Course.Id),
  },
  writableBy: { notebook: ["owner"] },
});

export type Row = Sync.Row<typeof Row>;

/** The term isn't one of the notebook's school's, or the server never admitted the notebook. */
export class UnknownTerm extends Schema.TaggedError<
  UnknownTerm,
  { readonly brand: unique symbol }
>()("Enrollment.UnknownTerm", { termId: Term.Id }) {}

/**
 * The grade level has classes in the term's school year and none of them was chosen, or the
 * chosen class isn't one of that grade level's.
 */
export class ClassRequired extends Schema.TaggedError<
  ClassRequired,
  { readonly brand: unique symbol }
>()("Enrollment.ClassRequired", {}) {}

/** The course isn't offered in that term to that grade level and class. */
export class CourseNotOffered extends Schema.TaggedError<
  CourseNotOffered,
  { readonly brand: unique symbol }
>()("Enrollment.CourseNotOffered", { courseId: Course.Id }) {}

/** Two chosen courses belong to one elective group, which allows one. */
export class TwoInOneGroup extends Schema.TaggedError<
  TwoInOneGroup,
  { readonly brand: unique symbol }
>()("Enrollment.TwoInOneGroup", { groupKey: Schema.String }) {}

export const Refusal = Schema.Union([UnknownTerm, ClassRequired, CourseNotOffered, TwoInOneGroup]);

export type Refusal = typeof Refusal.Type;

/**
 * Chooses the courses of one term at the notebook's school, replacing the term's earlier choice.
 * An empty list leaves every course of the term. The checks run in this order: the term, the
 * class, each course's offering, the elective groups.
 */
export const set = Sync.mutator("enrollment.set", {
  version: 1,
  args: Schema.Struct({
    notebook: Notebook.Id,
    termId: Term.Id,
    gradeLevel: School.GradeLevel,
    classId: Schema.optional(SchoolClass.Id),
    courseIds: Schema.Array(Course.Id),
  }),
  error: Refusal,
  writes: [Row],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Enrollment.set")(function* (args) {
    const tx = yield* Tx.Service;

    const notebook = yield* tx.get(Notebook.Row, args.notebook, args.notebook);

    if (Option.isNone(notebook)) return yield* new UnknownTerm({ termId: args.termId });

    const school = notebook.value.schoolId;
    const term = yield* tx.get(Term.Row, school, args.termId);

    if (Option.isNone(term)) return yield* new UnknownTerm({ termId: args.termId });

    const classes = yield* tx.list(SchoolClass.Row, school, {
      index: "schoolYearId",
      equals: term.value.schoolYearId,
    });

    const ofGradeLevel = classes.filter(({ row }) => row.gradeLevel === args.gradeLevel);

    const classFits =
      args.classId === undefined
        ? ofGradeLevel.length === 0
        : ofGradeLevel.some(({ id }) => id === args.classId);

    if (!classFits) return yield* new ClassRequired();

    const offerings = yield* tx.list(CourseOffering.Row, school, {
      index: "termId",
      equals: args.termId,
    });

    const offered = new Map<string, CourseOffering.Row>(
      offerings
        .filter(({ row }) => CourseOffering.isFor(row, args))
        .map(({ row }) => [row.courseId, row]),
    );

    const courseIds = Arr.dedupe(args.courseIds).sort();
    const groups = new Set<string>();

    for (const courseId of courseIds) {
      const offering = offered.get(courseId);

      if (offering === undefined) return yield* new CourseNotOffered({ courseId });

      const { groupKey } = offering;

      if (groupKey !== undefined) {
        if (groups.has(groupKey)) return yield* new TwoInOneGroup({ groupKey });

        groups.add(groupKey);
      }
    }

    const row = {
      termId: args.termId,
      gradeLevel: args.gradeLevel,
      classId: args.classId,
      courseIds,
    };

    const existing = yield* tx.get(Row, args.notebook, args.termId);

    yield* Option.isNone(existing)
      ? tx.insert(Row, args.notebook, args.termId, row)
      : tx.patch(Row, args.notebook, args.termId, row);
  }),
});

/** Whether any of the notebook's enrollments lists the course, in whichever term. */
export const isChosen = (notebook: Notebook.Id, courseId: Course.Id) =>
  Effect.flatMap(Tx.Service, (tx) => tx.list(Row, notebook)).pipe(
    Effect.map((entries) => entries.some(({ row }) => row.courseIds.includes(courseId))),
  );

/**
 * The members of a notebook read the Course space of every course its enrollments list. The
 * server applies the difference in every command that writes an enrollment, so a course chosen
 * offline shows its lessons once the push and the next pull went through. Past terms still count
 * until M3 bounds the rule to the current and later terms.
 */
export const courseMembership = Sync.membershipRule({
  kind: Course.Space,
  role: "reader",
  from: Row,
  spaces: (entries) => entries.flatMap(({ row }) => row.courseIds),
});
