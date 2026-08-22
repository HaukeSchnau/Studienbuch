import type { Grade } from "~/compat/mobile-v0";
import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it } from "vite-plus/test";
import {
  gradeClockAtom,
  gradeIdFactoryAtom,
  gradesAtom,
  gradeSignatureFactoryAtom,
  restoreLatestConfirmedGradeAtom,
  signGradeAtom,
  upsertGradeAtom,
  type GradeSigner,
} from "./grade-atoms";

const currentGrade: Grade = {
  id: "grade-current",
  courseId: "course-math",
  type: "ORAL",
  result: 8,
  date: new Date("2026-08-20T08:00:00.000Z"),
  teacherSignature: null,
  parentSignature: null,
};

const confirmedGrade: Grade = {
  id: "grade-confirmed",
  courseId: "course-math",
  type: "ORAL",
  result: 12,
  date: new Date("2026-07-20T08:00:00.000Z"),
  teacherSignature: "teacher:old",
  parentSignature: "parent:old",
};

describe("grade atoms", () => {
  it("updates, restores, and signs the current grade", () => {
    const restoredAt = new Date("2026-08-22T10:00:00.000Z");
    const registry = AtomRegistry.make({
      initialValues: [
        [gradesAtom, [currentGrade, confirmedGrade]],
        [gradeClockAtom, { now: () => restoredAt }],
        [gradeSignatureFactoryAtom, { create: (signer: GradeSigner) => `${signer}:new` }],
      ],
    });

    registry.set(upsertGradeAtom, {
      courseId: "course-math",
      type: "ORAL",
      result: 9,
      date: new Date("2026-08-21T08:00:00.000Z"),
    });
    registry.set(restoreLatestConfirmedGradeAtom, {
      courseId: "course-math",
      type: "ORAL",
      isOfAge: false,
    });
    registry.set(signGradeAtom, { gradeId: "grade-current", signer: "teacher" });
    registry.set(signGradeAtom, { gradeId: "grade-current", signer: "parent" });

    expect(registry.get(gradesAtom)[0]).toEqual({
      ...currentGrade,
      result: 12,
      date: restoredAt,
      teacherSignature: "teacher:new",
      parentSignature: "parent:new",
    });
    expect(registry.get(gradesAtom)[1]).toEqual(confirmedGrade);
    registry.dispose();
  });

  it("appends written grades but keeps one current grade for other types", () => {
    let nextId = 0;
    const registry = AtomRegistry.make({
      initialValues: [
        [gradesAtom, []],
        [gradeIdFactoryAtom, { create: () => `grade-${++nextId}` }],
      ],
    });

    registry.set(upsertGradeAtom, {
      courseId: "course-math",
      type: "WRITTEN",
      result: 10,
      date: new Date("2026-08-01T08:00:00.000Z"),
    });
    registry.set(upsertGradeAtom, {
      courseId: "course-math",
      type: "WRITTEN",
      result: 13,
      date: new Date("2026-08-15T08:00:00.000Z"),
    });
    registry.set(upsertGradeAtom, {
      courseId: "course-math",
      type: "MASTER",
      result: 9,
      date: new Date("2026-08-16T08:00:00.000Z"),
    });
    registry.set(upsertGradeAtom, {
      courseId: "course-math",
      type: "MASTER",
      result: 11,
      date: new Date("2026-08-17T08:00:00.000Z"),
    });

    const grades = registry.get(gradesAtom);
    expect(grades).toHaveLength(3);
    expect(grades.filter((grade) => grade.type === "WRITTEN")).toHaveLength(2);
    expect(grades.find((grade) => grade.type === "MASTER")).toMatchObject({
      id: "grade-3",
      result: 11,
      teacherSignature: null,
      parentSignature: null,
    });
    registry.dispose();
  });
});
