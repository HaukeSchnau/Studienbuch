import { and, eq, inArray } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import type { SnapshotResponse, StudentSnapshot } from "@stu/lib";
import { createSnapshotResolver } from "./snapshot-resolver";

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

  return rows
    .filter((row) => row.person && row.school && row.year && row.class)
    .map((row) => ({
      id: row.person.id,
      firstName: row.person.firstName,
      lastName: row.person.lastName,
      isOfAge: row.isOfAge ?? false,
      school: {
        id: row.school.id,
        name: row.school.name,
        stateCode: row.school.stateCode,
      },
      year: {
        name: row.year.name,
        startYear: row.year.startYear,
        graduationYear: row.year.graduationYear,
        school: row.year.school,
      },
      class: {
        identifierInYear: row.class.identifierInYear,
        startYear: row.class.startYear,
        school: row.class.school,
      },
    }));
};

const loadCourses = async (userId: string, ids: string[]): Promise<SnapshotResponse["courses"]> => {
  if (ids.length === 0) {
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
    .innerJoin(
      tables.CourseMemberships,
      and(eq(tables.CourseMemberships.course, tables.Courses.id), eq(tables.CourseMemberships.student, userId)),
    )
    .innerJoin(tables.Schools, eq(tables.Schools.id, tables.Courses.school))
    .innerJoin(
      tables.Semesters,
      and(
        eq(tables.Semesters.school, tables.Courses.school),
        eq(tables.Semesters.type, tables.Courses.semesterType),
        eq(tables.Semesters.year, tables.Courses.semesterYear),
      ),
    )
    .where(inArray(tables.Courses.id, ids));

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

  const teachersByCourse = new Map<string, SnapshotResponse["courses"][number]["teachers"]>();
  for (const row of teacherRows) {
    const existing = teachersByCourse.get(row.courseId) ?? [];
    existing.push({
      id: row.teacherId,
      firstName: row.firstName,
      lastName: row.lastName,
      abbrv: row.abbrv,
      salutation: row.salutation,
    });
    teachersByCourse.set(row.courseId, existing);
  }

  const classesByCourse = new Map<string, SnapshotResponse["courses"][number]["classes"]>();
  for (const row of classRows) {
    const existing = classesByCourse.get(row.courseId) ?? [];
    existing.push({
      identifierInYear: row.identifierInYear,
      startYear: row.startYear,
      school: row.school,
    });
    classesByCourse.set(row.courseId, existing);
  }

  return courseRows.map((row) => ({
    id: row.id,
    name: row.name,
    subject: row.subject,
    isMandatory: row.isMandatory,
    school: {
      id: row.schoolId,
      name: row.schoolName,
      stateCode: row.schoolStateCode,
    },
    semester: {
      name: row.semesterName,
      start: row.semesterStart.toISOString(),
      end: row.semesterEnd.toISOString(),
      school: row.schoolId,
      type: row.semesterType,
      year: row.semesterYear,
    },
    teachers: teachersByCourse.get(row.id) ?? [],
    classes: classesByCourse.get(row.id) ?? [],
  }));
};

export const resolveSnapshotForUser = createSnapshotResolver({
  loadStudents,
  loadCourses,
});
