import { describe, expect, it } from "vitest";
import { sampleCourseSnapshot, sampleStudentSnapshot } from "../snapshot-test-fixtures";
import {
  collectSnapshotClasses,
  collectSnapshotPersons,
  collectSnapshotSchools,
  collectSnapshotSemesters,
  collectSnapshotYears,
  mapAbsenceRowsToSnapshotProjections,
  mapCourseRowsToSnapshotCourses,
  mapGradeRowsToSnapshotProjections,
  mapStudentRowsToSnapshotStudents,
  mapTaskRowsToSnapshotTasks,
} from "./mappers";

describe("mapStudentRowsToSnapshotStudents", () => {
  it("filters incomplete rows and defaults null isOfAge to false", () => {
    const rows: Parameters<typeof mapStudentRowsToSnapshotStudents>[0] = [
      {
        isOfAge: null,
        person: {
          id: sampleStudentSnapshot.id,
          firstName: sampleStudentSnapshot.firstName,
          lastName: sampleStudentSnapshot.lastName,
        },
        school: sampleStudentSnapshot.school,
        year: sampleStudentSnapshot.year,
        class: sampleStudentSnapshot.class,
      },
      {
        isOfAge: true,
        person: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          firstName: "Filtered",
          lastName: "MissingClass",
        },
        school: sampleStudentSnapshot.school,
        year: sampleStudentSnapshot.year,
        class: null,
      },
      {
        isOfAge: true,
        person: null,
        school: sampleStudentSnapshot.school,
        year: sampleStudentSnapshot.year,
        class: sampleStudentSnapshot.class,
      },
    ];

    expect(mapStudentRowsToSnapshotStudents(rows)).toEqual([
      {
        id: sampleStudentSnapshot.id,
        firstName: sampleStudentSnapshot.firstName,
        lastName: sampleStudentSnapshot.lastName,
        isOfAge: false,
        school: sampleStudentSnapshot.school,
        year: sampleStudentSnapshot.year,
        class: sampleStudentSnapshot.class,
      },
    ]);
  });
});

describe("mapCourseRowsToSnapshotCourses", () => {
  it("aggregates teachers/classes by course and serializes semester dates", () => {
    const input: Parameters<typeof mapCourseRowsToSnapshotCourses>[0] = {
      courseRows: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Mathe LK",
          subject: "ma",
          isMandatory: false,
          schoolId: "igs-lil",
          schoolName: "IGS Lilienthal",
          schoolStateCode: "NI",
          semesterName: "Winter 2025/2026",
          semesterStart: new Date("2025-08-01T00:00:00.000Z"),
          semesterEnd: new Date("2026-01-31T23:59:59.000Z"),
          semesterType: "WINTER",
          semesterYear: 2025,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Deutsch",
          subject: "de",
          isMandatory: true,
          schoolId: "igs-lil",
          schoolName: "IGS Lilienthal",
          schoolStateCode: "NI",
          semesterName: "Sommer 2026",
          semesterStart: new Date("2026-02-01T00:00:00.000Z"),
          semesterEnd: new Date("2026-07-31T23:59:59.000Z"),
          semesterType: "SUMMER",
          semesterYear: 2026,
        },
      ],
      teacherRows: [
        {
          courseId: "22222222-2222-4222-8222-222222222222",
          teacherId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          firstName: "Dora",
          lastName: "Deutsch",
          abbrv: "DD",
          salutation: "Frau",
        },
        {
          courseId: "11111111-1111-4111-8111-111111111111",
          teacherId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          firstName: "Max",
          lastName: "Meyer",
          abbrv: null,
          salutation: null,
        },
        {
          courseId: "11111111-1111-4111-8111-111111111111",
          teacherId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          firstName: "Iris",
          lastName: "Iversen",
          abbrv: "II",
          salutation: "Frau",
        },
      ],
      classRows: [
        {
          courseId: "11111111-1111-4111-8111-111111111111",
          identifierInYear: "11a",
          startYear: 2024,
          school: "igs-lil",
        },
        {
          courseId: "11111111-1111-4111-8111-111111111111",
          identifierInYear: "11b",
          startYear: 2024,
          school: "igs-lil",
        },
      ],
    };

    expect(mapCourseRowsToSnapshotCourses(input)).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Mathe LK",
        subject: "ma",
        isMandatory: false,
        school: {
          id: "igs-lil",
          name: "IGS Lilienthal",
          stateCode: "NI",
        },
        semester: {
          name: "Winter 2025/2026",
          start: "2025-08-01T00:00:00.000Z",
          end: "2026-01-31T23:59:59.000Z",
          school: "igs-lil",
          type: "WINTER",
          year: 2025,
        },
        teachers: [
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            firstName: "Max",
            lastName: "Meyer",
            abbrv: null,
            salutation: null,
          },
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            firstName: "Iris",
            lastName: "Iversen",
            abbrv: "II",
            salutation: "Frau",
          },
        ],
        classes: [
          {
            identifierInYear: "11a",
            startYear: 2024,
            school: "igs-lil",
          },
          {
            identifierInYear: "11b",
            startYear: 2024,
            school: "igs-lil",
          },
        ],
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Deutsch",
        subject: "de",
        isMandatory: true,
        school: {
          id: "igs-lil",
          name: "IGS Lilienthal",
          stateCode: "NI",
        },
        semester: {
          name: "Sommer 2026",
          start: "2026-02-01T00:00:00.000Z",
          end: "2026-07-31T23:59:59.000Z",
          school: "igs-lil",
          type: "SUMMER",
          year: 2026,
        },
        teachers: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            firstName: "Dora",
            lastName: "Deutsch",
            abbrv: "DD",
            salutation: "Frau",
          },
        ],
        classes: [],
      },
    ]);
  });
});

describe("mapAbsenceRowsToSnapshotProjections", () => {
  it("maps dates to ISO strings and absenceCourses to courses", () => {
    const rows: Parameters<typeof mapAbsenceRowsToSnapshotProjections>[0] = [
      {
        date: new Date("2026-01-05T00:00:00.000Z"),
        reason: "Krank",
        parentSignature: null,
        absenceCourses: [
          {
            course: "11111111-1111-4111-8111-111111111111",
            teacherSignature: "signed-a",
          },
          {
            course: "22222222-2222-4222-8222-222222222222",
            teacherSignature: null,
          },
        ],
      },
    ];

    expect(mapAbsenceRowsToSnapshotProjections(rows)).toEqual([
      {
        date: "2026-01-05T00:00:00.000Z",
        reason: "Krank",
        parentSignature: null,
        courses: [
          {
            courseId: "11111111-1111-4111-8111-111111111111",
            teacherSignature: "signed-a",
          },
          {
            courseId: "22222222-2222-4222-8222-222222222222",
            teacherSignature: null,
          },
        ],
      },
    ]);
  });
});

describe("mapGradeRowsToSnapshotProjections", () => {
  it("maps date to ISO and passes through grade fields", () => {
    const rows: Parameters<typeof mapGradeRowsToSnapshotProjections>[0] = [
      {
        date: new Date("2026-01-15T08:15:00.000Z"),
        result: 13,
        type: "WRITTEN",
        course: "11111111-1111-4111-8111-111111111111",
        teacherSignature: "teacher-ok",
        parentSignature: null,
      },
    ];

    expect(mapGradeRowsToSnapshotProjections(rows)).toEqual([
      {
        date: "2026-01-15T08:15:00.000Z",
        result: 13,
        type: "WRITTEN",
        course: "11111111-1111-4111-8111-111111111111",
        teacherSignature: "teacher-ok",
        parentSignature: null,
      },
    ]);
  });
});

describe("mapTaskRowsToSnapshotTasks", () => {
  it("maps dueDate to ISO string and passes through task fields", () => {
    const rows: Parameters<typeof mapTaskRowsToSnapshotTasks>[0] = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        title: "Arbeitsblatt 5",
        description: "Rechne Aufgaben 1-4",
        dueDate: new Date("2026-01-20T10:30:00.000Z"),
        course: "11111111-1111-4111-8111-111111111111",
        assignee: "22222222-2222-4222-8222-222222222222",
        images: ["a.png", "b.png"],
        done: false,
      },
    ];

    expect(mapTaskRowsToSnapshotTasks(rows)).toEqual([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        title: "Arbeitsblatt 5",
        description: "Rechne Aufgaben 1-4",
        dueDate: "2026-01-20T10:30:00.000Z",
        course: "11111111-1111-4111-8111-111111111111",
        assignee: "22222222-2222-4222-8222-222222222222",
        images: ["a.png", "b.png"],
        done: false,
      },
    ]);
  });
});

describe("snapshot collector helpers", () => {
  it("deduplicates schools, years, classes, semesters, and persons by key", () => {
    const duplicateStudent = {
      ...sampleStudentSnapshot,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      firstName: "Bea",
      lastName: "Backup",
      school: {
        ...sampleStudentSnapshot.school,
        name: "IGS Lilienthal (Alt Name)",
      },
      year: {
        ...sampleStudentSnapshot.year,
        name: "11-alt",
        graduationYear: 2030,
      },
    };
    const shiftedStudent = {
      ...sampleStudentSnapshot,
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      firstName: "Cara",
      lastName: "ClassChange",
      year: {
        ...sampleStudentSnapshot.year,
        name: "12",
        startYear: 2025,
        graduationYear: 2028,
      },
      class: {
        ...sampleStudentSnapshot.class,
        identifierInYear: "12b",
        startYear: 2025,
      },
    };
    const winterCourse = {
      ...sampleCourseSnapshot,
      teachers: [
        {
          id: sampleStudentSnapshot.id,
          firstName: "Ada",
          lastName: "TeacherOverride",
          abbrv: "AT",
          salutation: "Frau" as const,
        },
      ],
    };
    const winterAlternativeCourse = {
      ...sampleCourseSnapshot,
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      name: "Mathe GK",
      semester: {
        ...sampleCourseSnapshot.semester,
        name: "Winter Alternative",
        start: "2025-08-10T00:00:00.000Z",
        end: "2026-01-20T23:59:59.000Z",
      },
      teachers: [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          firstName: "Tom",
          lastName: "Tutor",
          abbrv: "TT",
          salutation: "Herr" as const,
        },
      ],
    };
    const summerCourse = {
      ...sampleCourseSnapshot,
      id: "99999999-9999-4999-8999-999999999999",
      name: "Deutsch GK",
      subject: "de" as const,
      semester: {
        ...sampleCourseSnapshot.semester,
        name: "Sommer 2026",
        type: "SUMMER" as const,
        year: 2026,
        start: "2026-02-01T00:00:00.000Z",
        end: "2026-07-31T23:59:59.000Z",
      },
      teachers: [],
    };
    const snapshot: Parameters<typeof collectSnapshotSchools>[0] = {
      students: [sampleStudentSnapshot, duplicateStudent, shiftedStudent],
      courses: [winterCourse, winterAlternativeCourse, summerCourse],
      absences: [],
      grades: [],
    };

    expect(collectSnapshotSchools(snapshot)).toEqual([sampleCourseSnapshot.school]);
    expect(collectSnapshotYears(snapshot)).toEqual([
      duplicateStudent.year,
      shiftedStudent.year,
    ]);
    expect(collectSnapshotClasses(snapshot)).toEqual([
      sampleStudentSnapshot.class,
      shiftedStudent.class,
    ]);
    expect(collectSnapshotSemesters(snapshot)).toEqual([
      winterAlternativeCourse.semester,
      summerCourse.semester,
    ]);
    expect(collectSnapshotPersons(snapshot)).toEqual([
      {
        id: sampleStudentSnapshot.id,
        firstName: "Ada",
        lastName: "TeacherOverride",
        salutation: "Frau",
        abbrv: "AT",
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        firstName: "Bea",
        lastName: "Backup",
        salutation: null,
        abbrv: null,
      },
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        firstName: "Cara",
        lastName: "ClassChange",
        salutation: null,
        abbrv: null,
      },
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        firstName: "Tom",
        lastName: "Tutor",
        salutation: "Herr",
        abbrv: "TT",
      },
    ]);
  });
});
