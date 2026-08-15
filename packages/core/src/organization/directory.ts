import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as CalendarDateRange from "../foundation/calendar-date-range";
import { AcademicTerm, Cohort, validateAcademicTerms } from "./academic-term";
import { School, SubjectCatalog } from "./catalog";
import { ClassGroup, CourseOffering } from "./course-offering";
import { CourseChoiceGroup, Enrollment } from "./enrollment";

/** A complete academic school-directory slice suitable for cross-entity validation. */
export const SchoolDirectory = Schema.Struct({
  school: School,
  subjectCatalog: SubjectCatalog,
  terms: Schema.Array(AcademicTerm),
  cohorts: Schema.Array(Cohort),
  classGroups: Schema.Array(ClassGroup),
  courseOfferings: Schema.Array(CourseOffering),
  choiceGroups: Schema.Array(CourseChoiceGroup),
  enrollments: Schema.Array(Enrollment),
});
export interface SchoolDirectory extends Schema.Schema.Type<typeof SchoolDirectory> {}

export class InvalidSchoolDirectory extends Schema.TaggedError<InvalidSchoolDirectory>()(
  "Organization.InvalidSchoolDirectory",
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

const invalidDirectory = (
  entity: InvalidSchoolDirectory["entity"],
  entityId: string,
  reason: InvalidSchoolDirectory["reason"],
) => new InvalidSchoolDirectory({ entity, entityId, reason });

/** Validates references and school/term scope after every constituent schema has decoded. */
export const validateSchoolDirectory = Effect.fn("Organization.validateSchoolDirectory")(function* (
  structure: SchoolDirectory,
) {
  const schoolId = structure.school.id;
  if (structure.subjectCatalog.schoolId !== schoolId) {
    return yield* invalidDirectory("SubjectCatalog", schoolId, "WrongSchool");
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
      return yield* invalidDirectory(entity, schoolId, "DuplicateId");
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
      return yield* invalidDirectory("AcademicTerm", term.id, "WrongSchool");
    }
  }
  for (const cohort of structure.cohorts) {
    if (cohort.schoolId !== schoolId) {
      return yield* invalidDirectory("Cohort", cohort.id, "WrongSchool");
    }
    if (terms.get(cohort.entryTermId)?.schoolId !== schoolId) {
      return yield* invalidDirectory("Cohort", cohort.id, "UnknownReference");
    }
  }
  for (const group of structure.classGroups) {
    if (group.schoolId !== schoolId) {
      return yield* invalidDirectory("ClassGroup", group.id, "WrongSchool");
    }
    if (terms.get(group.termId)?.schoolId !== schoolId) {
      return yield* invalidDirectory("ClassGroup", group.id, "UnknownReference");
    }
    if (group.cohortId !== undefined && cohorts.get(group.cohortId)?.schoolId !== schoolId) {
      return yield* invalidDirectory("ClassGroup", group.id, "UnknownReference");
    }
  }
  for (const offering of structure.courseOfferings) {
    if (offering.schoolId !== schoolId) {
      return yield* invalidDirectory("CourseOffering", offering.id, "WrongSchool");
    }
    if (
      terms.get(offering.termId)?.schoolId !== schoolId ||
      subjects.get(offering.subjectId) === undefined
    ) {
      return yield* invalidDirectory("CourseOffering", offering.id, "UnknownReference");
    }
    if (
      offering.classGroupIds.some((id) => {
        const group = classGroups.get(id);
        return group === undefined || group.termId !== offering.termId;
      })
    ) {
      return yield* invalidDirectory("CourseOffering", offering.id, "WrongTerm");
    }
  }
  for (const group of structure.choiceGroups) {
    if (group.schoolId !== schoolId || terms.get(group.termId)?.schoolId !== schoolId) {
      return yield* invalidDirectory("CourseChoiceGroup", group.id, "WrongSchool");
    }
    if (group.offeringIds.some((id) => offerings.get(id)?.termId !== group.termId)) {
      return yield* invalidDirectory("CourseChoiceGroup", group.id, "WrongTerm");
    }
  }
  for (const enrollment of structure.enrollments) {
    const offering = offerings.get(enrollment.courseOfferingId);
    if (offering === undefined) {
      return yield* invalidDirectory("Enrollment", enrollment.id, "UnknownReference");
    }
    const term = terms.get(offering.termId);
    if (term === undefined || !CalendarDateRange.encloses(term.interval, enrollment.effective)) {
      return yield* invalidDirectory("Enrollment", enrollment.id, "OutsideTerm");
    }
    if (enrollment.origin._tag === "Choice") {
      const choice = choiceGroups.get(enrollment.origin.choiceGroupId);
      if (choice === undefined || !choice.offeringIds.includes(offering.id)) {
        return yield* invalidDirectory("Enrollment", enrollment.id, "UnknownReference");
      }
    }
  }
  yield* validateAcademicTerms(structure.terms);
  return structure;
});
