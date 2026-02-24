import type {
  CourseSnapshot,
  SnapshotResponse,
  StudentSnapshot,
  TaskProjectionSnapshot,
} from "./snapshot";

export const studentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const courseId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

export const sampleStudentSnapshot: StudentSnapshot = {
  id: studentId,
  firstName: "Ada",
  lastName: "Student",
  isOfAge: false,
  school: {
    id: "igs-lil",
    name: "IGS Lilienthal",
    stateCode: "NI",
  },
  year: {
    name: "11",
    startYear: 2024,
    graduationYear: 2027,
    school: "igs-lil",
  },
  class: {
    identifierInYear: "11a",
    startYear: 2024,
    school: "igs-lil",
  },
};

export const sampleCourseSnapshot: CourseSnapshot = {
  id: courseId,
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
  teachers: [],
  classes: [],
};

export const sampleTaskProjectionSnapshot: TaskProjectionSnapshot = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  title: "Arbeitsblatt 5",
  description: "Quadratische Funktionen bearbeiten",
  dueDate: "2026-01-12T08:00:00.000Z",
  course: courseId,
  assignee: studentId,
  images: [],
  done: false,
};

export const sampleSnapshotResponse: SnapshotResponse = {
  students: [sampleStudentSnapshot],
  courses: [sampleCourseSnapshot],
  absences: [],
  grades: [],
  tasks: [sampleTaskProjectionSnapshot],
};
