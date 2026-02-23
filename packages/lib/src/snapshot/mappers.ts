import type {
  ClassSnapshot,
  CourseSnapshot,
  SchoolSnapshot,
  SemesterSnapshot,
  SnapshotResponse,
  StudentSnapshot,
  YearSnapshot,
} from "../snapshot";
import { uniqueBy } from "../snapshot-helpers";

const schoolFromStudent = (student: StudentSnapshot): SchoolSnapshot => student.school;
const schoolFromCourse = (course: CourseSnapshot): SchoolSnapshot => course.school;

const personFromStudent = (student: SnapshotResponse["students"][number]) => ({
  id: student.id,
  firstName: student.firstName,
  lastName: student.lastName,
  salutation: null,
  abbrv: null,
});

const personFromTeacher = (teacher: SnapshotResponse["courses"][number]["teachers"][number]) => ({
  id: teacher.id,
  firstName: teacher.firstName,
  lastName: teacher.lastName,
  salutation: teacher.salutation,
  abbrv: teacher.abbrv,
});

export type SnapshotPerson = ReturnType<typeof personFromTeacher>;

type AbsenceCourseProjectionRow = {
  course: SnapshotResponse["absences"][number]["courses"][number]["courseId"];
  teacherSignature: SnapshotResponse["absences"][number]["courses"][number]["teacherSignature"];
};

type AbsenceProjectionRow = {
  date: Date;
  reason: SnapshotResponse["absences"][number]["reason"];
  parentSignature: SnapshotResponse["absences"][number]["parentSignature"];
  absenceCourses: readonly AbsenceCourseProjectionRow[];
};

type GradeProjectionRow = {
  date: Date;
  result: SnapshotResponse["grades"][number]["result"];
  type: SnapshotResponse["grades"][number]["type"];
  course: SnapshotResponse["grades"][number]["course"];
  teacherSignature: SnapshotResponse["grades"][number]["teacherSignature"];
  parentSignature: SnapshotResponse["grades"][number]["parentSignature"];
};

export const mapAbsenceRowsToSnapshotProjections = (
  rows: readonly AbsenceProjectionRow[],
): SnapshotResponse["absences"] =>
  rows.map((absence) => ({
    date: absence.date.toISOString(),
    reason: absence.reason,
    parentSignature: absence.parentSignature,
    courses: absence.absenceCourses.map((courseAbsence) => ({
      courseId: courseAbsence.course,
      teacherSignature: courseAbsence.teacherSignature,
    })),
  }));

export const mapGradeRowsToSnapshotProjections = (
  rows: readonly GradeProjectionRow[],
): SnapshotResponse["grades"] =>
  rows.map((grade) => ({
    date: grade.date.toISOString(),
    result: grade.result,
    type: grade.type,
    course: grade.course,
    teacherSignature: grade.teacherSignature,
    parentSignature: grade.parentSignature,
  }));

export const collectSnapshotSchools = (snapshot: SnapshotResponse): SchoolSnapshot[] =>
  uniqueBy(
    [...snapshot.students.map(schoolFromStudent), ...snapshot.courses.map(schoolFromCourse)],
    (school) => school.id,
  );

export const collectSnapshotYears = (snapshot: SnapshotResponse): YearSnapshot[] =>
  uniqueBy(
    snapshot.students.map((student) => student.year),
    (year) => `${year.school}:${year.startYear}`,
  );

export const collectSnapshotClasses = (snapshot: SnapshotResponse): ClassSnapshot[] =>
  uniqueBy(
    snapshot.students.map((student) => student.class),
    (cls) => `${cls.school}:${cls.startYear}:${cls.identifierInYear}`,
  );

export const collectSnapshotSemesters = (snapshot: SnapshotResponse): SemesterSnapshot[] =>
  uniqueBy(
    snapshot.courses.map((course) => course.semester),
    (semester) => `${semester.school}:${semester.type}:${semester.year}`,
  );

export const collectSnapshotPersons = (snapshot: SnapshotResponse): SnapshotPerson[] =>
  uniqueBy(
    [
      ...snapshot.students.map(personFromStudent),
      ...snapshot.courses.flatMap((course) => course.teachers.map(personFromTeacher)),
    ],
    (person) => person.id,
  );
