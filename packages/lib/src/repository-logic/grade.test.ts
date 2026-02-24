import { describe, expect, test, vi } from "vitest";
import { gradeCourseTypeDatePredicates, gradeCourseTypePredicates, gradePendingSignaturePredicate } from "./grade";

describe("gradeCourseTypePredicates", () => {
  test("builds course/type predicates in stable order", () => {
    const eq = vi.fn((column: unknown, value: unknown) => `eq(${String(column)},${String(value)})`);

    const result = gradeCourseTypePredicates(
      {
        course: "course_col",
        type: "type_col",
      },
      {
        course: "course-1",
        type: "MASTER",
      },
      eq,
    );

    expect(result).toEqual(["eq(course_col,course-1)", "eq(type_col,MASTER)"]);
    expect(eq.mock.calls).toEqual([
      ["course_col", "course-1"],
      ["type_col", "MASTER"],
    ]);
  });
});

describe("gradeCourseTypeDatePredicates", () => {
  test("builds course/type/date predicates in stable order", () => {
    const eq = vi.fn((column: unknown, value: unknown) => `eq(${String(column)},${String(value)})`);

    const result = gradeCourseTypeDatePredicates(
      {
        course: "course_col",
        type: "type_col",
        date: "date_col",
      },
      {
        course: "course-1",
        type: "ORAL",
        date: "2025-09-01",
      },
      eq,
    );

    expect(result).toEqual(["eq(course_col,course-1)", "eq(type_col,ORAL)", "eq(date_col,2025-09-01)"]);
    expect(eq.mock.calls).toEqual([
      ["course_col", "course-1"],
      ["type_col", "ORAL"],
      ["date_col", "2025-09-01"],
    ]);
  });
});

describe("gradePendingSignaturePredicate", () => {
  test("builds predicate for missing teacher or parent signature", () => {
    const isNull = vi.fn((column: unknown) => `isNull(${String(column)})`);
    const or = vi.fn((left: string, right: string) => `or(${left},${right})`);

    const result = gradePendingSignaturePredicate(
      {
        teacherSignature: "teacher_signature_col",
        parentSignature: "parent_signature_col",
      },
      { isNull, or },
    );

    expect(result).toBe("or(isNull(teacher_signature_col),isNull(parent_signature_col))");
    expect(isNull.mock.calls).toEqual([["teacher_signature_col"], ["parent_signature_col"]]);
    expect(or).toHaveBeenCalledWith("isNull(teacher_signature_col)", "isNull(parent_signature_col)");
  });
});
