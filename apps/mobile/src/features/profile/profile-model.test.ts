import type { Course, Grade, Task } from "@stu/core";
import { describe, expect, it } from "vite-plus/test";
import { getProfileCoursesModel } from "./profile-model";

const course = (id: string, patch: Partial<Course> = {}): Course => ({
  id,
  name: id,
  subject: "de",
  teachers: [],
  semesterId: "s1",
  ...patch,
});

const grade = (courseId: string, type: Grade["type"], result: number): Grade => ({
  id: `${courseId}-${type}-${result}`,
  courseId,
  type,
  result,
  date: new Date("2026-06-01T08:00:00.000Z"),
  teacherSignature: "teacher",
  parentSignature: "parent",
});

const task = (courseId: string, dueDate: Date, done = false): Task => ({
  id: `${courseId}-task`,
  courseId,
  title: "Aufgabe",
  description: "",
  dueDate,
  done,
  attachments: [],
});

describe("getProfileCoursesModel", () => {
  it("sorts exam courses and splits P1/P2 from compact exam courses", () => {
    const model = getProfileCoursesModel({
      courses: [
        course("ge", { examSlot: "P4" }),
        course("de", { examSlot: "P1" }),
        course("ma", { examSlot: "P2" }),
        course("sp"),
      ],
      getCourseGrades: () => [],
      getCourseTasks: () => [],
    });

    expect(model.examCourses.map((signal) => signal.course.id)).toEqual(["de", "ma", "ge"]);
    expect(model.featuredExamCourses.map((signal) => signal.course.id)).toEqual(["de", "ma"]);
    expect(model.compactExamCourses.map((signal) => signal.course.id)).toEqual(["ge"]);
    expect(model.regularCourses.map((signal) => signal.course.id)).toEqual(["sp"]);
  });

  it("uses master grade as the primary signal and keeps oral/written secondary", () => {
    const model = getProfileCoursesModel({
      courses: [course("de", { examSlot: "P1" })],
      getCourseGrades: (courseId) => [
        grade(courseId, "MASTER", 11),
        grade(courseId, "ORAL", 12),
        grade(courseId, "WRITTEN", 10),
      ],
      getCourseTasks: () => [],
    });

    expect(model.examCourses[0]?.primaryGrade).toEqual({ label: "Gesamt", value: "11 P" });
    expect(model.examCourses[0]?.oralGrade).toBe("12");
    expect(model.examCourses[0]?.writtenGrade).toBe("10");
  });

  it("shows urgent task labels without turning profile into a task list", () => {
    const today = new Date("2026-06-12T08:00:00.000Z");
    const model = getProfileCoursesModel({
      courses: [course("de")],
      getCourseGrades: () => [],
      getCourseTasks: (courseId) => [task(courseId, new Date("2026-06-13T08:00:00.000Z"))],
      today,
    });

    expect(model.regularCourses[0]?.taskSignal).toBe("morgen fällig");
  });
});
