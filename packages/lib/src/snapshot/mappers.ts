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
type SnapshotStudentRow = SnapshotResponse["students"][number];
type SnapshotCourseRow = SnapshotResponse["courses"][number];

type StudentProjectionRow = {
  isOfAge: boolean | null;
  person:
    | {
        id: SnapshotStudentRow["id"];
        firstName: SnapshotStudentRow["firstName"];
        lastName: SnapshotStudentRow["lastName"];
      }
    | null;
  school:
    | {
        id: SnapshotStudentRow["school"]["id"];
        name: SnapshotStudentRow["school"]["name"];
        stateCode: SnapshotStudentRow["school"]["stateCode"];
      }
    | null;
  year:
    | {
        name: SnapshotStudentRow["year"]["name"];
        startYear: SnapshotStudentRow["year"]["startYear"];
        graduationYear: SnapshotStudentRow["year"]["graduationYear"];
        school: SnapshotStudentRow["year"]["school"];
      }
    | null;
  class:
    | {
        identifierInYear: SnapshotStudentRow["class"]["identifierInYear"];
        startYear: SnapshotStudentRow["class"]["startYear"];
        school: SnapshotStudentRow["class"]["school"];
      }
    | null;
};

type CourseProjectionRow = {
  id: SnapshotCourseRow["id"];
  name: SnapshotCourseRow["name"];
  subject: SnapshotCourseRow["subject"];
  isMandatory: SnapshotCourseRow["isMandatory"];
  schoolId: SnapshotCourseRow["school"]["id"];
  schoolName: SnapshotCourseRow["school"]["name"];
  schoolStateCode: SnapshotCourseRow["school"]["stateCode"];
  semesterName: SnapshotCourseRow["semester"]["name"];
  semesterStart: Date;
  semesterEnd: Date;
  semesterType: SnapshotCourseRow["semester"]["type"];
  semesterYear: SnapshotCourseRow["semester"]["year"];
};

type TeacherProjectionRow = {
  courseId: SnapshotCourseRow["id"];
  teacherId: SnapshotCourseRow["teachers"][number]["id"];
  firstName: SnapshotCourseRow["teachers"][number]["firstName"];
  lastName: SnapshotCourseRow["teachers"][number]["lastName"];
  abbrv: SnapshotCourseRow["teachers"][number]["abbrv"];
  salutation: SnapshotCourseRow["teachers"][number]["salutation"];
};

type ClassProjectionRow = {
  courseId: SnapshotCourseRow["id"];
  identifierInYear: SnapshotCourseRow["classes"][number]["identifierInYear"];
  startYear: SnapshotCourseRow["classes"][number]["startYear"];
  school: SnapshotCourseRow["classes"][number]["school"];
};

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

const hasRequiredStudentRelations = (
  row: StudentProjectionRow,
): row is StudentProjectionRow & {
  person: NonNullable<StudentProjectionRow["person"]>;
  school: NonNullable<StudentProjectionRow["school"]>;
  year: NonNullable<StudentProjectionRow["year"]>;
  class: NonNullable<StudentProjectionRow["class"]>;
} => Boolean(row.person && row.school && row.year && row.class);

export const mapStudentRowsToSnapshotStudents = (
  rows: readonly StudentProjectionRow[],
): SnapshotResponse["students"] =>
  rows.filter(hasRequiredStudentRelations).map((row) => ({
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

export const mapCourseRowsToSnapshotCourses = ({
  courseRows,
  teacherRows,
  classRows,
}: {
  courseRows: readonly CourseProjectionRow[];
  teacherRows: readonly TeacherProjectionRow[];
  classRows: readonly ClassProjectionRow[];
}): SnapshotResponse["courses"] => {
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
