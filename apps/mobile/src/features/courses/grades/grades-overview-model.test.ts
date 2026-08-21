import type { Grade } from "~/compat/mobile-v0";
import { describe, expect, it } from "vite-plus/test";
import { getGradesOverviewModel } from "./grades-overview-model";

const grade = (id: string, type: Grade["type"]): Grade => ({
  id,
  type,
  courseId: "de-1",
  result: 12,
  date: new Date("2026-06-03T00:00:00"),
  teacherSignature: null,
  parentSignature: null,
});

describe("getGradesOverviewModel", () => {
  it("groups grades by grade type", () => {
    const master = grade("master", "MASTER");
    const oral = grade("oral", "ORAL");
    const written = grade("written", "WRITTEN");

    expect(getGradesOverviewModel([master, oral, written])).toEqual({
      masterGrades: [master],
      oralGrades: [oral],
      writtenGrades: [written],
    });
  });
});
