import { describe, expect, it } from "vitest";
import { courseId, studentId } from "./snapshot-test-fixtures";
import { snapshotEntitiesForEvent } from "./snapshot";

describe("snapshotEntitiesForEvent", () => {
  it("returns student + deduplicated course refs for absence.recorded", () => {
    const refs = snapshotEntitiesForEvent({
      id: "11111111-1111-4111-8111-111111111111",
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      type: "absence.recorded",
      data: {
        studentId,
        date: new Date("2026-01-01T00:00:00.000Z"),
        reason: "Krank",
        courseIds: [courseId, courseId],
      },
    });

    expect(refs).toEqual([
      { kind: "student", id: studentId },
      { kind: "course", id: courseId },
    ]);
  });

  it("returns only student ref for student.joined", () => {
    const refs = snapshotEntitiesForEvent({
      id: "99999999-9999-4999-8999-999999999999",
      timestamp: new Date("2026-01-01T00:00:00.000Z"),
      type: "student.joined",
      data: {
        studentId,
        name: "Ada Student",
        school: "igs-lil",
        isOfAge: false,
        class: {
          identifier: "11a",
          startYear: 2024,
        },
      },
    });

    expect(refs).toEqual([{ kind: "student", id: studentId }]);
  });
});
