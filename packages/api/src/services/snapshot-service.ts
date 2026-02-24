import { and, eq, inArray } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import {
  mapAbsenceRowsToSnapshotProjections,
  mapCourseRowsToSnapshotCourses,
  mapGradeRowsToSnapshotProjections,
  mapStudentRowsToSnapshotStudents,
  mapTaskRowsToSnapshotTasks,
  type SnapshotResponse,
  type StudentSnapshot,
} from "@stu/lib";
import { createSnapshotResolver } from "../snapshot-resolver";

const loadStudents = async (userId: string, ids: string[]): Promise<StudentSnapshot[]> => {
  if (ids.length === 0) {
    return [];
  }

  const rows = await db.query.Students.findMany({
    where: and(eq(tables.Students.person, userId), inArray(tables.Students.person, ids)),
    with: {
      person: true,
      school: true,
      year: true,
      class: true,
    },
  });

  return mapStudentRowsToSnapshotStudents(rows);
};

const loadUserSchoolId = async (userId: string) => {
  const activatedLicense = await db.query.LicenseKeys.findFirst({
    where: eq(tables.LicenseKeys.activatedBy, userId),
  });

  return activatedLicense?.school ?? null;
};

const loadCourses = async (userId: string, ids: string[]): Promise<SnapshotResponse["courses"]> => {
  if (ids.length === 0) {
    return [];
  }
  const schoolId = await loadUserSchoolId(userId);
  if (!schoolId) {
    return [];
  }

  const courseRows = await db
    .select({
      id: tables.Courses.id,
      name: tables.Courses.name,
      subject: tables.Courses.subject,
      isMandatory: tables.Courses.isMandatory,
      schoolId: tables.Schools.id,
      schoolName: tables.Schools.name,
      schoolStateCode: tables.Schools.stateCode,
      semesterName: tables.Semesters.name,
      semesterStart: tables.Semesters.start,
      semesterEnd: tables.Semesters.end,
      semesterType: tables.Semesters.type,
      semesterYear: tables.Semesters.year,
    })
    .from(tables.Courses)
    .innerJoin(tables.Schools, eq(tables.Schools.id, tables.Courses.school))
    .innerJoin(
      tables.Semesters,
      and(
        eq(tables.Semesters.school, tables.Courses.school),
        eq(tables.Semesters.type, tables.Courses.semesterType),
        eq(tables.Semesters.year, tables.Courses.semesterYear),
      ),
    )
    .where(and(inArray(tables.Courses.id, ids), eq(tables.Courses.school, schoolId)));

  const resolvedCourseIds = [...new Set(courseRows.map((row) => row.id))];
  if (resolvedCourseIds.length === 0) {
    return [];
  }

  const teacherRows = await db
    .select({
      courseId: tables.CoursesToTeachers.course,
      teacherId: tables.Persons.id,
      firstName: tables.Persons.firstName,
      lastName: tables.Persons.lastName,
      abbrv: tables.Persons.abbrv,
      salutation: tables.Persons.salutation,
    })
    .from(tables.CoursesToTeachers)
    .innerJoin(tables.Persons, eq(tables.Persons.id, tables.CoursesToTeachers.teacher))
    .where(inArray(tables.CoursesToTeachers.course, resolvedCourseIds));

  const classRows = await db
    .select({
      courseId: tables.CoursesToClasses.course,
      identifierInYear: tables.CoursesToClasses.classIdentifier,
      startYear: tables.CoursesToClasses.classStartYear,
      school: tables.CoursesToClasses.school,
    })
    .from(tables.CoursesToClasses)
    .where(inArray(tables.CoursesToClasses.course, resolvedCourseIds));

  return mapCourseRowsToSnapshotCourses({
    courseRows,
    teacherRows,
    classRows,
  });
};

const loadAbsences = async (userId: string): Promise<SnapshotResponse["absences"]> => {
  const absenceRows = await db.query.AbsenceDays.findMany({
    where: eq(tables.AbsenceDays.student, userId),
    with: {
      absenceCourses: true,
    },
  });

  return mapAbsenceRowsToSnapshotProjections(absenceRows);
};

const loadGrades = async (userId: string): Promise<SnapshotResponse["grades"]> => {
  const gradeRows = await db.query.Grades.findMany({
    where: eq(tables.Grades.student, userId),
  });

  return mapGradeRowsToSnapshotProjections(gradeRows);
};

const loadTasks = async (userId: string): Promise<NonNullable<SnapshotResponse["tasks"]>> => {
  const taskRows = await db.query.Tasks.findMany({
    where: eq(tables.Tasks.assignee, userId),
  });

  return mapTaskRowsToSnapshotTasks(taskRows);
};

export const resolveSnapshotForUser = createSnapshotResolver({
  loadStudents,
  loadCourses,
  loadAbsences,
  loadGrades,
  loadTasks,
});
