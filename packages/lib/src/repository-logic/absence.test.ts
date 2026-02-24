import { describe, expect, test } from "vitest";
import { shouldDeleteAbsenceDayAfterRemovingCourseAbsences } from "./absence";

describe("shouldDeleteAbsenceDayAfterRemovingCourseAbsences", () => {
  test("returns true when no course absences remain", () => {
    expect(shouldDeleteAbsenceDayAfterRemovingCourseAbsences([])).toBe(true);
  });

  test("returns false when course absences remain", () => {
    expect(shouldDeleteAbsenceDayAfterRemovingCourseAbsences([{ course: "MATH-01" }])).toBe(false);
  });
});
