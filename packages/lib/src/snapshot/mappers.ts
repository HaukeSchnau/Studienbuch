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
