import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import { NonBlankText } from "../foundation/non-blank-text";
import {
  AcademicTermId,
  ClassGroupId,
  CourseChoiceGroupId,
  CourseOfferingId,
  EnrollmentId,
  SchoolId,
  SchoolMembershipId,
} from "./identity";
import type { CourseOffering } from "./course-offering";

export const EnrollmentOrigin = Schema.TaggedUnion({
  InheritedFromClass: { classGroupId: ClassGroupId },
  Required: {},
  Choice: { choiceGroupId: CourseChoiceGroupId },
  Optional: {},
});
export type EnrollmentOrigin = typeof EnrollmentOrigin.Type;

export const Enrollment = Schema.Struct({
  id: EnrollmentId,
  studentMembershipId: SchoolMembershipId,
  courseOfferingId: CourseOfferingId,
  effective: CalendarDateRange.Schema,
  origin: EnrollmentOrigin,
});
export interface Enrollment extends Schema.Schema.Type<typeof Enrollment> {}

export const SelectionCardinality = Schema.Struct({
  minimum: Schema.Natural,
  maximum: Schema.Natural,
}).check(
  Schema.makeFilter(({ minimum, maximum }) => minimum <= maximum, {
    expected: "a selection cardinality whose minimum is not greater than its maximum",
  }),
);
export interface SelectionCardinality extends Schema.Schema.Type<typeof SelectionCardinality> {}

export const CourseChoiceGroup = Schema.Struct({
  id: CourseChoiceGroupId,
  schoolId: SchoolId,
  termId: AcademicTermId,
  name: NonBlankText.Schema,
  offeringIds: Schema.NonEmptyArray(CourseOfferingId),
  cardinality: SelectionCardinality,
}).check(
  Schema.makeFilter(
    ({ offeringIds, cardinality }) =>
      new Set(offeringIds).size === offeringIds.length && cardinality.maximum <= offeringIds.length,
    {
      expected:
        "a course choice group with unique offerings and a maximum no larger than its alternatives",
    },
  ),
);
export interface CourseChoiceGroup extends Schema.Schema.Type<typeof CourseChoiceGroup> {}

export const EnrollmentSuggestion = Schema.Struct({
  previousEnrollmentId: EnrollmentId,
  previousOfferingId: CourseOfferingId,
  suggestedOfferingId: CourseOfferingId,
  reason: Schema.Literal("SameSubjectInNextTerm"),
});
export interface EnrollmentSuggestion extends Schema.Schema.Type<typeof EnrollmentSuggestion> {}

export class CourseChoiceViolation extends Schema.TaggedError<CourseChoiceViolation>()(
  "CourseChoiceViolation",
  {
    choiceGroupId: CourseChoiceGroupId,
    reason: Schema.Literals([
      "DuplicateSelection",
      "OfferingOutsideGroup",
      "BelowMinimum",
      "AboveMaximum",
    ]),
    selectedCount: Schema.Natural,
  },
) {}

export class EnrollmentNotRemovable extends Schema.TaggedError<EnrollmentNotRemovable>()(
  "EnrollmentNotRemovable",
  {
    enrollmentId: EnrollmentId,
    reason: Schema.Literals(["Required", "InheritedFromClass", "ChoiceGroupUnavailable"]),
  },
) {}

/** Effective intervals are closed; both boundary dates participate in the enrollment. */
export const isEnrollmentEffectiveOn = (enrollment: Enrollment, date: PlainDate.Record) =>
  CalendarDateRange.contains(enrollment.effective, date);

export const validateCourseChoice = Effect.fn("Organization.validateCourseChoice")(function* (
  group: CourseChoiceGroup,
  selectedOfferingIds: ReadonlyArray<CourseOfferingId>,
) {
  const distinct = new Set<CourseOfferingId>(selectedOfferingIds);
  if (distinct.size !== selectedOfferingIds.length) {
    return yield* new CourseChoiceViolation({
      choiceGroupId: group.id,
      reason: "DuplicateSelection",
      selectedCount: distinct.size,
    });
  }
  if (selectedOfferingIds.some((id) => !group.offeringIds.includes(id))) {
    return yield* new CourseChoiceViolation({
      choiceGroupId: group.id,
      reason: "OfferingOutsideGroup",
      selectedCount: selectedOfferingIds.length,
    });
  }
  if (selectedOfferingIds.length < group.cardinality.minimum) {
    return yield* new CourseChoiceViolation({
      choiceGroupId: group.id,
      reason: "BelowMinimum",
      selectedCount: selectedOfferingIds.length,
    });
  }
  if (selectedOfferingIds.length > group.cardinality.maximum) {
    return yield* new CourseChoiceViolation({
      choiceGroupId: group.id,
      reason: "AboveMaximum",
      selectedCount: selectedOfferingIds.length,
    });
  }
  return selectedOfferingIds;
});

export const removeEnrollment = Effect.fn("Organization.removeEnrollment")(function* (
  enrollments: ReadonlyArray<Enrollment>,
  enrollmentId: EnrollmentId,
  choiceGroups: ReadonlyArray<CourseChoiceGroup>,
) {
  const enrollment = enrollments.find((candidate) => candidate.id === enrollmentId);
  if (enrollment === undefined) return enrollments;
  if (enrollment.origin._tag === "Required" || enrollment.origin._tag === "InheritedFromClass") {
    return yield* new EnrollmentNotRemovable({
      enrollmentId,
      reason: enrollment.origin._tag,
    });
  }
  const remaining = enrollments.filter((candidate) => candidate.id !== enrollmentId);
  if (enrollment.origin._tag === "Choice") {
    const choiceGroupId = enrollment.origin.choiceGroupId;
    const group = choiceGroups.find((candidate) => candidate.id === choiceGroupId);
    if (group === undefined) {
      return yield* new EnrollmentNotRemovable({
        enrollmentId,
        reason: "ChoiceGroupUnavailable",
      });
    }
    const selected = remaining
      .filter(
        (candidate) =>
          candidate.studentMembershipId === enrollment.studentMembershipId &&
          candidate.origin._tag === "Choice" &&
          candidate.origin.choiceGroupId === group.id,
      )
      .map((candidate) => candidate.courseOfferingId);
    yield* validateCourseChoice(group, selected);
  }
  return remaining;
});

/**
 * Suggests only unambiguous continuations. Ambiguous or missing subject matches deliberately
 * produce no suggestion so an application can ask the student instead of guessing.
 */
export const suggestEnrollmentContinuations = (
  input: suggestEnrollmentContinuations.Input,
): ReadonlyArray<EnrollmentSuggestion> => {
  const previousById = new Map(input.previousOfferings.map((offering) => [offering.id, offering]));
  return input.previousEnrollments.flatMap((enrollment) => {
    const previous = previousById.get(enrollment.courseOfferingId);
    if (previous === undefined) return [];
    const candidates = input.targetOfferings.filter(
      (offering) =>
        offering.termId === input.targetTermId &&
        offering.schoolId === previous.schoolId &&
        offering.subjectId === previous.subjectId,
    );
    const candidate = candidates.length === 1 ? candidates[0] : undefined;
    if (candidate === undefined) return [];
    return [
      EnrollmentSuggestion.make({
        previousEnrollmentId: enrollment.id,
        previousOfferingId: previous.id,
        suggestedOfferingId: candidate.id,
        reason: "SameSubjectInNextTerm",
      }),
    ];
  });
};

export declare namespace suggestEnrollmentContinuations {
  export interface Input {
    readonly previousEnrollments: ReadonlyArray<Enrollment>;
    readonly previousOfferings: ReadonlyArray<CourseOffering>;
    readonly targetOfferings: ReadonlyArray<CourseOffering>;
    readonly targetTermId: AcademicTermId;
  }
}
