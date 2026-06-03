import { describe, expect, it } from "vitest";
import {
  getAbsenceRouteParams,
  getCourseRouteParams,
  getGradeRouteParams,
  getTaskRouteParams,
} from "./params";

describe("route params", () => {
  it("normalizes repeated task params", () => {
    expect(getTaskRouteParams({ taskId: ["task-1", "ignored"] })).toEqual({ taskId: "task-1" });
  });

  it("normalizes course params", () => {
    expect(getCourseRouteParams({ course: ["de-1"] })).toEqual({ courseId: "de-1" });
  });

  it("parses absence params into a date and course ids", () => {
    const date = new Date("2026-06-03T00:00:00.000Z");

    expect(
      getAbsenceRouteParams({
        date: String(date.getTime()),
        courses: "de-1;ma-1",
      }),
    ).toEqual({
      date,
      courseIds: ["de-1", "ma-1"],
    });
  });

  it("parses grade params", () => {
    const date = new Date("2026-06-03T00:00:00.000Z");

    expect(
      getGradeRouteParams({
        course: "de-1",
        date: String(date.getTime()),
        type: "WRITTEN",
      }),
    ).toEqual({
      courseId: "de-1",
      date,
      type: "WRITTEN",
    });
  });
});
