import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import { AcademicTerm, validateAcademicTerms } from "./academic-term";
import { AcademicYear, Cohort, validateAcademicYears } from "./academic-year";
import { School, SubjectCatalog } from "./catalog";
import {
  ClassGroup,
  ClassGroupAcademicYear,
  CourseOffering,
  CourseOfferingAcademicYear,
} from "./course-offering";
import { CourseChoiceGroup, Enrollment } from "./enrollment";
import { Building, Department, Room } from "./school-structure";
import {
  ClassTeacherAssignment,
  DepartmentAssignment,
  SchoolMembership,
  StudentClassAssignment,
  StudentMembership,
} from "./membership";
import { Person } from "./person";

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
  people: Schema.Array(Person),
  memberships: Schema.Array(SchoolMembership),
  students: Schema.Array(StudentMembership),
  studentClassAssignments: Schema.Array(StudentClassAssignment),
  classTeacherAssignments: Schema.Array(ClassTeacherAssignment),
  departmentAssignments: Schema.Array(DepartmentAssignment),
  classGroups: Schema.Array(ClassGroup),
  classGroupAcademicYears: Schema.Array(ClassGroupAcademicYear),
  courseOfferings: Schema.Array(CourseOffering),
  courseOfferingAcademicYears: Schema.Array(CourseOfferingAcademicYear),
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
      "Person",
      "SchoolMembership",
      "StudentMembership",
      "StudentClassAssignment",
      "ClassTeacherAssignment",
      "DepartmentAssignment",
      "ClassGroup",
      "ClassGroupAcademicYear",
      "CourseOffering",
      "CourseOfferingAcademicYear",
      "CourseChoiceGroup",
      "Enrollment",
    ]),
    entityId: Schema.String,
    reason: Schema.Literals([
      "DuplicateId",
      "WrongSchool",
      "UnknownReference",
      "WrongTerm",
      "WrongAcademicYear",
      "OutsideTerm",
      "OutsideAcademicYear",
      "OutsideMembership",
      "WrongRole",
    ]),
  },
) {}

const invalidDirectory = (
  entity: InvalidSchoolDirectory["entity"],
  entityId: string,
  reason: InvalidSchoolDirectory["reason"],
) => InvalidSchoolDirectory.make({ entity, entityId, reason });

/** Validates references and school-year scope after every constituent schema has decoded. */
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
    ["Person", structure.people],
    ["SchoolMembership", structure.memberships],
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
  const people = new Map(structure.people.map((item) => [item.id, item]));
  const memberships = new Map(structure.memberships.map((item) => [item.id, item]));
  const classGroupAcademicYearKeys = structure.classGroupAcademicYears.map(
    (item) => `${item.classGroupId}\u0000${item.academicYearId}`,
  );
  const classGroupAcademicYears = new Set(classGroupAcademicYearKeys);
  if (classGroupAcademicYears.size !== classGroupAcademicYearKeys.length) {
    return yield* invalidDirectory("ClassGroupAcademicYear", schoolId, "DuplicateId");
  }
  const offerings = new Map(structure.courseOfferings.map((item) => [item.id, item]));
  const courseOfferingAcademicYearKeys = structure.courseOfferingAcademicYears.map(
    (item) => `${item.courseOfferingId}\u0000${item.academicYearId}`,
  );
  const courseOfferingAcademicYears = new Set(courseOfferingAcademicYearKeys);
  if (courseOfferingAcademicYears.size !== courseOfferingAcademicYearKeys.length) {
    return yield* invalidDirectory("CourseOfferingAcademicYear", schoolId, "DuplicateId");
  }
  const choiceGroups = new Map(structure.choiceGroups.map((item) => [item.id, item]));
  const departments = new Map(structure.departments.map((item) => [item.id, item]));
  const buildings = new Map(structure.buildings.map((item) => [item.id, item]));

  const studentIds = structure.students.map((item) => item.membershipId);
  if (new Set(studentIds).size !== studentIds.length) {
    return yield* invalidDirectory("StudentMembership", schoolId, "DuplicateId");
  }
  const studentAssignmentKeys = structure.studentClassAssignments.map(
    (item) =>
      `${item.studentMembershipId}\u0000${item.classGroupId}\u0000${PlainDate.toString(item.effective.start)}\u0000${PlainDate.toString(item.effective.end)}`,
  );
  if (new Set(studentAssignmentKeys).size !== studentAssignmentKeys.length) {
    return yield* invalidDirectory("StudentClassAssignment", schoolId, "DuplicateId");
  }
  const classTeacherKeys = structure.classTeacherAssignments.map(
    (item) =>
      `${item.teacherMembershipId}\u0000${item.classGroupId}\u0000${item.academicYearId}\u0000${item.position}`,
  );
  if (new Set(classTeacherKeys).size !== classTeacherKeys.length) {
    return yield* invalidDirectory("ClassTeacherAssignment", schoolId, "DuplicateId");
  }
  const departmentAssignmentKeys = structure.departmentAssignments.map(
    (item) => `${item.schoolMembershipId}\u0000${item.departmentId}\u0000${item.academicYearId}`,
  );
  if (new Set(departmentAssignmentKeys).size !== departmentAssignmentKeys.length) {
    return yield* invalidDirectory("DepartmentAssignment", schoolId, "DuplicateId");
  }

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
  for (const membership of structure.memberships) {
    if (membership.schoolId !== schoolId) {
      return yield* invalidDirectory("SchoolMembership", membership.id, "WrongSchool");
    }
    if (!people.has(membership.personId)) {
      return yield* invalidDirectory("SchoolMembership", membership.id, "UnknownReference");
    }
  }
  for (const student of structure.students) {
    const membership = memberships.get(student.membershipId);
    if (membership === undefined) {
      return yield* invalidDirectory("StudentMembership", student.membershipId, "UnknownReference");
    }
    if (!membership.roles.includes("Student")) {
      return yield* invalidDirectory("StudentMembership", student.membershipId, "WrongRole");
    }
    if (student.cohortId !== undefined && !cohorts.has(student.cohortId)) {
      return yield* invalidDirectory("StudentMembership", student.membershipId, "UnknownReference");
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
      academicYears.get(placement.academicYearId)?.schoolId !== schoolId ||
      (placement.departmentId !== undefined && !departments.has(placement.departmentId))
    ) {
      return yield* invalidDirectory("ClassGroupAcademicYear", entityId, "UnknownReference");
    }
  }
  for (const assignment of structure.studentClassAssignments) {
    const membership = memberships.get(assignment.studentMembershipId);
    const entityId = `${assignment.studentMembershipId}/${assignment.classGroupId}`;
    if (membership === undefined || !classGroups.has(assignment.classGroupId)) {
      return yield* invalidDirectory("StudentClassAssignment", entityId, "UnknownReference");
    }
    if (!membership.roles.includes("Student")) {
      return yield* invalidDirectory("StudentClassAssignment", entityId, "WrongRole");
    }
    if (!CalendarDateRange.encloses(membership.effective, assignment.effective)) {
      return yield* invalidDirectory("StudentClassAssignment", entityId, "OutsideMembership");
    }
  }
  for (const assignment of structure.classTeacherAssignments) {
    const membership = memberships.get(assignment.teacherMembershipId);
    const entityId = `${assignment.teacherMembershipId}/${assignment.classGroupId}/${assignment.academicYearId}`;
    if (
      membership === undefined ||
      !classGroupAcademicYears.has(`${assignment.classGroupId}\u0000${assignment.academicYearId}`)
    ) {
      return yield* invalidDirectory("ClassTeacherAssignment", entityId, "UnknownReference");
    }
    if (!membership.roles.includes("Teacher")) {
      return yield* invalidDirectory("ClassTeacherAssignment", entityId, "WrongRole");
    }
  }
  for (const assignment of structure.departmentAssignments) {
    const membership = memberships.get(assignment.schoolMembershipId);
    const entityId = `${assignment.schoolMembershipId}/${assignment.departmentId}/${assignment.academicYearId}`;
    if (
      membership === undefined ||
      !departments.has(assignment.departmentId) ||
      !academicYears.has(assignment.academicYearId)
    ) {
      return yield* invalidDirectory("DepartmentAssignment", entityId, "UnknownReference");
    }
  }
  for (const offering of structure.courseOfferings) {
    if (offering.schoolId !== schoolId) {
      return yield* invalidDirectory("CourseOffering", offering.id, "WrongSchool");
    }
  }
  for (const representation of structure.courseOfferingAcademicYears) {
    const entityId = `${representation.courseOfferingId}/${representation.academicYearId}`;
    const offering = offerings.get(representation.courseOfferingId);
    const academicYear = academicYears.get(representation.academicYearId);
    if (
      offering?.schoolId !== schoolId ||
      academicYear?.schoolId !== schoolId ||
      (representation.subjectId !== undefined &&
        subjects.get(representation.subjectId) === undefined) ||
      representation.cohortIds.some((id) => cohorts.get(id)?.schoolId !== schoolId)
    ) {
      return yield* invalidDirectory("CourseOfferingAcademicYear", entityId, "UnknownReference");
    }
    if (
      representation.classGroupIds.some((id) => {
        const group = classGroups.get(id);
        return (
          group === undefined ||
          !classGroupAcademicYears.has(`${group.id}\u0000${representation.academicYearId}`)
        );
      })
    ) {
      return yield* invalidDirectory("CourseOfferingAcademicYear", entityId, "WrongAcademicYear");
    }
  }
  for (const group of structure.choiceGroups) {
    if (group.schoolId !== schoolId || terms.get(group.termId)?.schoolId !== schoolId) {
      return yield* invalidDirectory("CourseChoiceGroup", group.id, "WrongSchool");
    }
    const academicYearId = terms.get(group.termId)?.academicYearId;
    if (
      academicYearId === undefined ||
      group.offeringIds.some(
        (id) =>
          offerings.get(id)?.schoolId !== schoolId ||
          !courseOfferingAcademicYears.has(`${id}\u0000${academicYearId}`),
      )
    ) {
      return yield* invalidDirectory("CourseChoiceGroup", group.id, "WrongTerm");
    }
  }
  for (const enrollment of structure.enrollments) {
    const offering = offerings.get(enrollment.courseOfferingId);
    if (offering === undefined) {
      return yield* invalidDirectory("Enrollment", enrollment.id, "UnknownReference");
    }
    const representedYears = structure.courseOfferingAcademicYears
      .filter((item) => item.courseOfferingId === offering.id)
      .flatMap((item) => {
        const academicYear = academicYears.get(item.academicYearId);
        return academicYear === undefined ? [] : [academicYear];
      });
    if (
      !representedYears.some((academicYear) =>
        CalendarDateRange.encloses(academicYear.interval, enrollment.effective),
      )
    ) {
      return yield* invalidDirectory("Enrollment", enrollment.id, "OutsideAcademicYear");
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
