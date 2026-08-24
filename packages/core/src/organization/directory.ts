import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import { AcademicTerm, validateAcademicTerms } from "./academic-term";
import { AcademicYear, Cohort, validateAcademicYears } from "./academic-year";
import { School, SubjectCatalog } from "./catalog";
import { ClassGroup, ClassGroupAcademicYear, CourseOffering } from "./course-offering";
import { CourseChoiceGroup, Enrollment } from "./enrollment";
import { Building, Department, Room } from "./school-structure";

/** A complete academic school-directory slice suitable for cross-entity validation. */
export const SchoolDirectory = Schema.Struct({
  school: School,
  subjectCatalog: SubjectCatalog,
  academicYears: Schema.Array(AcademicYear),
  terms: Schema.Array(AcademicTerm),
  cohorts: Schema.Array(Cohort),
  departments: Schema.Array(Department),
  buildings: Schema.Array(Building),
  rooms: Schema.Array(Room),
  classGroups: Schema.Array(ClassGroup),
  classGroupAcademicYears: Schema.Array(ClassGroupAcademicYear),
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
      "AcademicYear",
      "AcademicTerm",
      "Cohort",
      "Department",
      "Building",
      "Room",
      "ClassGroup",
      "ClassGroupAcademicYear",
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
      "OutsideAcademicYear",
    ]),
  },
) {}

const invalidDirectory = (
  entity: InvalidSchoolDirectory["entity"],
  entityId: string,
  reason: InvalidSchoolDirectory["reason"],
) => InvalidSchoolDirectory.make({ entity, entityId, reason });

/** Validates references and school/term scope after every constituent schema has decoded. */
export const validateSchoolDirectory = Effect.fn("Organization.validateSchoolDirectory")(function* (
  structure: SchoolDirectory,
) {
  const schoolId = structure.school.id;
  if (structure.subjectCatalog.schoolId !== schoolId) {
    return yield* invalidDirectory("SubjectCatalog", schoolId, "WrongSchool");
  }
  const collections = [
    ["AcademicYear", structure.academicYears],
    ["AcademicTerm", structure.terms],
    ["Cohort", structure.cohorts],
    ["Department", structure.departments],
    ["Building", structure.buildings],
    ["Room", structure.rooms],
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
  const academicYears = new Map(structure.academicYears.map((item) => [item.id, item]));
  const terms = new Map(structure.terms.map((item) => [item.id, item]));
  const subjects = new Map(structure.subjectCatalog.subjects.map((item) => [item.id, item]));
  const cohorts = new Map(structure.cohorts.map((item) => [item.id, item]));
  const classGroups = new Map(structure.classGroups.map((item) => [item.id, item]));
  const classGroupAcademicYearKeys = structure.classGroupAcademicYears.map(
    (item) => `${item.classGroupId}\u0000${item.academicYearId}`,
  );
  const classGroupAcademicYears = new Set(classGroupAcademicYearKeys);
  if (classGroupAcademicYears.size !== classGroupAcademicYearKeys.length) {
    return yield* invalidDirectory("ClassGroupAcademicYear", schoolId, "DuplicateId");
  }
  const offerings = new Map(structure.courseOfferings.map((item) => [item.id, item]));
  const choiceGroups = new Map(structure.choiceGroups.map((item) => [item.id, item]));
  const departments = new Map(structure.departments.map((item) => [item.id, item]));
  const buildings = new Map(structure.buildings.map((item) => [item.id, item]));

  for (const academicYear of structure.academicYears) {
    if (academicYear.schoolId !== schoolId) {
      return yield* invalidDirectory("AcademicYear", academicYear.id, "WrongSchool");
    }
  }

  for (const term of structure.terms) {
    if (term.schoolId !== schoolId) {
      return yield* invalidDirectory("AcademicTerm", term.id, "WrongSchool");
    }
    const academicYear = academicYears.get(term.academicYearId);
    if (academicYear === undefined) {
      return yield* invalidDirectory("AcademicTerm", term.id, "UnknownReference");
    }
    if (!CalendarDateRange.encloses(academicYear.interval, term.interval)) {
      return yield* invalidDirectory("AcademicTerm", term.id, "OutsideAcademicYear");
    }
  }
  for (const cohort of structure.cohorts) {
    if (cohort.schoolId !== schoolId) {
      return yield* invalidDirectory("Cohort", cohort.id, "WrongSchool");
    }
    if (academicYears.get(cohort.entryAcademicYearId)?.schoolId !== schoolId) {
      return yield* invalidDirectory("Cohort", cohort.id, "UnknownReference");
    }
  }
  for (const department of structure.departments) {
    if (department.schoolId !== schoolId) {
      return yield* invalidDirectory("Department", department.id, "WrongSchool");
    }
  }
  for (const building of structure.buildings) {
    if (building.schoolId !== schoolId) {
      return yield* invalidDirectory("Building", building.id, "WrongSchool");
    }
  }
  for (const room of structure.rooms) {
    if (room.schoolId !== schoolId) {
      return yield* invalidDirectory("Room", room.id, "WrongSchool");
    }
    if (
      (room.departmentId !== undefined && !departments.has(room.departmentId)) ||
      (room.buildingId !== undefined && !buildings.has(room.buildingId))
    ) {
      return yield* invalidDirectory("Room", room.id, "UnknownReference");
    }
  }
  for (const group of structure.classGroups) {
    if (group.schoolId !== schoolId) {
      return yield* invalidDirectory("ClassGroup", group.id, "WrongSchool");
    }
    if (group.cohortId !== undefined && cohorts.get(group.cohortId)?.schoolId !== schoolId) {
      return yield* invalidDirectory("ClassGroup", group.id, "UnknownReference");
    }
  }
  for (const placement of structure.classGroupAcademicYears) {
    const entityId = `${placement.classGroupId}/${placement.academicYearId}`;
    if (
      classGroups.get(placement.classGroupId)?.schoolId !== schoolId ||
      academicYears.get(placement.academicYearId)?.schoolId !== schoolId
    ) {
      return yield* invalidDirectory("ClassGroupAcademicYear", entityId, "UnknownReference");
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
        const term = terms.get(offering.termId);
        return (
          group === undefined ||
          term === undefined ||
          !classGroupAcademicYears.has(`${group.id}\u0000${term.academicYearId}`)
        );
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
  yield* validateAcademicYears(structure.academicYears);
  yield* validateAcademicTerms(structure.terms);
  return structure;
});
