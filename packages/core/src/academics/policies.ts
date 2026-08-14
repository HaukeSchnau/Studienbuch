import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  AcademicTermId,
  CourseChoiceGroupId,
  CourseOfferingId,
  EnrollmentId,
  SchoolId,
  dateIntervalsOverlap,
} from "../primitives";
import {
  AcademicTerm,
  AcademicStructure,
  Cohort,
  CohortProgressionPolicy,
  CourseChoiceGroup,
  CourseOffering,
  Enrollment,
  EnrollmentSuggestion,
  GradeLevel,
} from "./model";

export class InvalidAcademicStructure extends Schema.TaggedError<InvalidAcademicStructure>()(
  "Academics.InvalidStructure",
  {
    entity: Schema.Literals([
      "SubjectCatalog",
      "AcademicTerm",
      "Cohort",
      "ClassGroup",
      "CourseOffering",
      "CourseChoiceGroup",
      "Enrollment",
    ]),
    entityId: Schema.String,
    reason: Schema.Literals([
      "DuplicateId",
      "WrongSchool",
      "UnknownReference",
      "WrongTerm",
      "OutsideTerm",
    ]),
  },
) {}

const invalidStructure = (
  entity: InvalidAcademicStructure["entity"],
  entityId: string,
  reason: InvalidAcademicStructure["reason"],
) => new InvalidAcademicStructure({ entity, entityId, reason });

/** Validates references and school/term scope after every constituent schema has decoded. */
export const validateAcademicStructure = Effect.fn("Academics.validateStructure")(function* (
  structure: AcademicStructure,
) {
  const schoolId = structure.school.id;
  if (structure.subjectCatalog.schoolId !== schoolId) {
    return yield* invalidStructure("SubjectCatalog", schoolId, "WrongSchool");
  }
  const collections = [
    ["AcademicTerm", structure.terms],
    ["Cohort", structure.cohorts],
    ["ClassGroup", structure.classGroups],
    ["CourseOffering", structure.courseOfferings],
    ["CourseChoiceGroup", structure.choiceGroups],
    ["Enrollment", structure.enrollments],
  ] as const;
  for (const [entity, items] of collections) {
    const ids = items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      return yield* invalidStructure(entity, schoolId, "DuplicateId");
    }
  }
  const terms = new Map(structure.terms.map((item) => [item.id, item]));
  const subjects = new Map(structure.subjectCatalog.subjects.map((item) => [item.id, item]));
  const cohorts = new Map(structure.cohorts.map((item) => [item.id, item]));
  const classGroups = new Map(structure.classGroups.map((item) => [item.id, item]));
  const offerings = new Map(structure.courseOfferings.map((item) => [item.id, item]));
  const choiceGroups = new Map(structure.choiceGroups.map((item) => [item.id, item]));

  for (const term of structure.terms) {
    if (term.schoolId !== schoolId) {
      return yield* invalidStructure("AcademicTerm", term.id, "WrongSchool");
    }
  }
  for (const cohort of structure.cohorts) {
    if (cohort.schoolId !== schoolId) {
      return yield* invalidStructure("Cohort", cohort.id, "WrongSchool");
    }
    if (terms.get(cohort.entryTermId)?.schoolId !== schoolId) {
      return yield* invalidStructure("Cohort", cohort.id, "UnknownReference");
    }
  }
  for (const group of structure.classGroups) {
    if (group.schoolId !== schoolId) {
      return yield* invalidStructure("ClassGroup", group.id, "WrongSchool");
    }
    if (terms.get(group.termId)?.schoolId !== schoolId) {
      return yield* invalidStructure("ClassGroup", group.id, "UnknownReference");
    }
    if (group.cohortId !== undefined && cohorts.get(group.cohortId)?.schoolId !== schoolId) {
      return yield* invalidStructure("ClassGroup", group.id, "UnknownReference");
    }
  }
  for (const offering of structure.courseOfferings) {
    if (offering.schoolId !== schoolId) {
      return yield* invalidStructure("CourseOffering", offering.id, "WrongSchool");
    }
    if (
      terms.get(offering.termId)?.schoolId !== schoolId ||
      subjects.get(offering.subjectId) === undefined
    ) {
      return yield* invalidStructure("CourseOffering", offering.id, "UnknownReference");
    }
    if (
      offering.classGroupIds.some((id) => {
        const group = classGroups.get(id);
        return group === undefined || group.termId !== offering.termId;
      })
    ) {
      return yield* invalidStructure("CourseOffering", offering.id, "WrongTerm");
    }
  }
  for (const group of structure.choiceGroups) {
    if (group.schoolId !== schoolId || terms.get(group.termId)?.schoolId !== schoolId) {
      return yield* invalidStructure("CourseChoiceGroup", group.id, "WrongSchool");
    }
    if (group.offeringIds.some((id) => offerings.get(id)?.termId !== group.termId)) {
      return yield* invalidStructure("CourseChoiceGroup", group.id, "WrongTerm");
    }
  }
  for (const enrollment of structure.enrollments) {
    const offering = offerings.get(enrollment.courseOfferingId);
    if (offering === undefined) {
      return yield* invalidStructure("Enrollment", enrollment.id, "UnknownReference");
    }
    const term = terms.get(offering.termId);
    if (
      term === undefined ||
      enrollment.effective.start < term.interval.start ||
      enrollment.effective.end > term.interval.end
    ) {
      return yield* invalidStructure("Enrollment", enrollment.id, "OutsideTerm");
    }
    if (enrollment.origin._tag === "Choice") {
      const choice = choiceGroups.get(enrollment.origin.choiceGroupId);
      if (choice === undefined || !choice.offeringIds.includes(offering.id)) {
        return yield* invalidStructure("Enrollment", enrollment.id, "UnknownReference");
      }
    }
  }
  yield* validateAcademicTerms(structure.terms);
  return structure;
});

export class OverlappingAcademicTerms extends Schema.TaggedError<OverlappingAcademicTerms>()(
  "OverlappingAcademicTerms",
  {
    schoolId: SchoolId,
    firstTermId: AcademicTermId,
    secondTermId: AcademicTermId,
  },
) {}

export class AcademicTermUnavailable extends Schema.TaggedError<AcademicTermUnavailable>()(
  "AcademicTermUnavailable",
  {
    termId: AcademicTermId,
    reason: Schema.Literals(["Unknown", "WrongSchool", "BeforeCohortEntry"]),
  },
) {}

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

export const validateAcademicTerms = Effect.fn("Academics.validateAcademicTerms")(function* (
  terms: ReadonlyArray<AcademicTerm>,
) {
  const ordered = [...terms].sort((left, right) =>
    left.interval.start.localeCompare(right.interval.start),
  );
  for (const [index, first] of ordered.entries()) {
    for (const second of ordered.slice(index + 1)) {
      if (
        first.schoolId === second.schoolId &&
        dateIntervalsOverlap(first.interval, second.interval)
      ) {
        return yield* new OverlappingAcademicTerms({
          schoolId: first.schoolId,
          firstTermId: first.id,
          secondTermId: second.id,
        });
      }
    }
  }
  return ordered;
});

export const gradeLevelAt = Effect.fn("Academics.gradeLevelAt")(function* (
  cohort: Cohort,
  policy: CohortProgressionPolicy,
  terms: ReadonlyArray<AcademicTerm>,
  targetTermId: AcademicTermId,
) {
  const ordered = yield* validateAcademicTerms(terms);
  const schoolTerms = ordered.filter((term) => term.schoolId === cohort.schoolId);
  const entryIndex = schoolTerms.findIndex((term) => term.id === cohort.entryTermId);
  const targetIndex = schoolTerms.findIndex((term) => term.id === targetTermId);
  if (targetIndex < 0) {
    const target = ordered.find((term) => term.id === targetTermId);
    return yield* new AcademicTermUnavailable({
      termId: targetTermId,
      reason: target === undefined ? "Unknown" : "WrongSchool",
    });
  }
  if (entryIndex < 0) {
    return yield* new AcademicTermUnavailable({ termId: cohort.entryTermId, reason: "Unknown" });
  }
  if (targetIndex < entryIndex) {
    return yield* new AcademicTermUnavailable({
      termId: targetTermId,
      reason: "BeforeCohortEntry",
    });
  }
  const progressed = Math.floor((targetIndex - entryIndex) / policy.termsPerGradeLevel);
  return GradeLevel.make(Math.min(cohort.entryGradeLevel + progressed, policy.maximumGradeLevel));
});

export const validateCourseChoice = Effect.fn("Academics.validateCourseChoice")(function* (
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

export const removeEnrollment = Effect.fn("Academics.removeEnrollment")(function* (
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
export const suggestEnrollmentContinuations = (input: {
  readonly previousEnrollments: ReadonlyArray<Enrollment>;
  readonly previousOfferings: ReadonlyArray<CourseOffering>;
  readonly targetOfferings: ReadonlyArray<CourseOffering>;
  readonly targetTermId: AcademicTermId;
}): ReadonlyArray<EnrollmentSuggestion> => {
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
