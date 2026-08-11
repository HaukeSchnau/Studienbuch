import type { Absence } from "@stu/core";
import { describe, expect, it } from "vite-plus/test";
import { getAbsencesPageModel } from "./absences-page-model";

const absence = (
  id: string,
  signatures?: Partial<Pick<Absence, "parentSignature" | "teacherSignature">>,
): Absence => ({
  id,
  date: new Date("2026-06-03T00:00:00"),
  courseIds: ["de-1"],
  reason: "Test",
  parentSignature: signatures?.parentSignature ?? null,
  teacherSignature: signatures?.teacherSignature ?? null,
});

describe("getAbsencesPageModel", () => {
  it("separates excused and unexcused absences", () => {
    const unexcused = absence("unexcused", { parentSignature: "parent" });
    const excused = absence("excused", {
      parentSignature: "parent",
      teacherSignature: "teacher",
    });

    expect(getAbsencesPageModel({ absences: [unexcused, excused], isOfAge: false })).toEqual({
      unexcused: [unexcused],
      excused: [excused],
    });
  });
});
