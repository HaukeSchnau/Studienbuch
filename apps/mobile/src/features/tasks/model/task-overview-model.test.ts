import type { Task } from "@stu/core";
import { describe, expect, it } from "vite-plus/test";
import { getTaskOverviewModel } from "./task-overview-model";

const task = (id: string): Task => ({
  id,
  courseId: "de-1",
  title: id,
  description: "",
  dueDate: new Date("2026-06-03T00:00:00"),
  done: false,
  attachments: [],
});

describe("getTaskOverviewModel", () => {
  it("uses a single card row for short task lists", () => {
    expect(getTaskOverviewModel([task("a"), task("b"), task("c")])).toMatchObject({
      crossAxisCount: 1,
      sectionHeight: 225,
    });
  });

  it("uses two card rows for larger task lists", () => {
    expect(getTaskOverviewModel([task("a"), task("b"), task("c"), task("d")])).toMatchObject({
      crossAxisCount: 2,
      sectionHeight: 450,
    });
  });
});
