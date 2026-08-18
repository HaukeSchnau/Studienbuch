import { describe, expect, it } from "vite-plus/test";
import {
  getCourseTasks,
  getRequiredSetupPath,
  groupAbsencesByConfirmation,
  isGradeConfirmed,
  isTaskArchived,
  type Absence,
  type Semester,
  type Task,
  type UserProfile,
} from "./mobile-v0";

const baseUser: UserProfile = {
  name: "Hauke",
  isOfAge: false,
  yearId: "y12",
  classId: "c12a",
  schoolName: "IGS Lilienthal",
  licenseKey: "STUB-U123",
};

const currentSemester: Semester = {
  id: "s2",
  name: "2. Semester",
  start: new Date("2026-02-01T00:00:00"),
  end: new Date("2026-07-31T00:00:00"),
};

describe("setup policy", () => {
  it("requires setup in the same order as the mobile flow", () => {
    expect(
      getRequiredSetupPath({
        user: { ...baseUser, licenseKey: "" },
        currentSemester,
        selectedCourseIdsBySemester: { s2: ["de-1"] },
      }),
    ).toBe("/setup/license-key");

    expect(
      getRequiredSetupPath({
        user: { ...baseUser, name: "" },
        currentSemester,
        selectedCourseIdsBySemester: { s2: ["de-1"] },
      }),
    ).toBe("/setup/name-and-year");

    expect(
      getRequiredSetupPath({
        user: baseUser,
        currentSemester,
        selectedCourseIdsBySemester: { s2: [] },
      }),
    ).toBe("/setup/class-and-courses");
  });
});

describe("task policies", () => {
  const tasks: Task[] = [
    {
      id: "done",
      courseId: "de-1",
      title: "Done",
      description: "",
      dueDate: new Date("2026-06-10T00:00:00"),
      done: true,
      attachments: [],
    },
    {
      id: "soon",
      courseId: "de-1",
      title: "Soon",
      description: "",
      dueDate: new Date("2026-06-04T00:00:00"),
      done: false,
      attachments: [],
    },
    {
      id: "later",
      courseId: "ma-1",
      title: "Later",
      description: "",
      dueDate: new Date("2026-06-06T00:00:00"),
      done: false,
      attachments: [],
    },
  ];

  it("sorts active tasks before done tasks by due date", () => {
    expect(getCourseTasks(tasks).map((task) => task.id)).toEqual(["soon", "later", "done"]);
  });

  it("archives done tasks and old overdue tasks", () => {
    expect(isTaskArchived(tasks[0]!, new Date("2026-06-03T00:00:00"))).toBe(true);
    expect(
      isTaskArchived(
        { ...tasks[1]!, dueDate: new Date("2026-05-20T00:00:00") },
        new Date("2026-06-03T00:00:00"),
      ),
    ).toBe(true);
  });
});

describe("confirmation policies", () => {
  it("requires teacher plus parent signatures for underage students", () => {
    expect(
      isGradeConfirmed({
        id: "g1",
        courseId: "de-1",
        type: "ORAL",
        result: 12,
        date: new Date("2026-06-03T00:00:00"),
        teacherSignature: "teacher",
        parentSignature: null,
      }),
    ).toBe(false);
  });

  it("groups absences by confirmation state", () => {
    const absences: Absence[] = [
      {
        id: "a1",
        date: new Date("2026-06-01T00:00:00"),
        courseIds: ["de-1"],
        reason: "Arzttermin",
        teacherSignature: null,
        parentSignature: null,
      },
      {
        id: "a2",
        date: new Date("2026-06-02T00:00:00"),
        courseIds: ["ma-1"],
        reason: "Erkältung",
        teacherSignature: "teacher",
        parentSignature: "parent",
      },
    ];

    expect(groupAbsencesByConfirmation(absences)).toEqual({
      unexcused: [absences[0]],
      excused: [absences[1]],
    });
  });
});
