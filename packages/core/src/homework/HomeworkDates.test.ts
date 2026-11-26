import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";
import { Fixture } from "../testing/Fixture.ts";
import { HomeworkDates } from "./HomeworkDates.ts";

const { date } = Fixture;

describe("HomeworkDates", () => {
  const today = date("2026-10-29");

  const homework = (id: string, dueOn: string, doneOn?: string): HomeworkDates.Listed => ({
    id,
    dueOn: date(dueOn),
    doneOn: doneOn === undefined ? undefined : date(doneOn),
  });

  it("lists open homework before done, each by due date, then by id", () => {
    const listed = [
      homework("a", "2026-10-30", "2026-10-28"),
      homework("b", "2026-11-05"),
      homework("d", "2026-10-31"),
      homework("c", "2026-10-31"),
      homework("e", "2026-10-20", "2026-10-19"),
    ];

    expect(Arr.sort(listed, HomeworkDates.order).map(({ id }) => id)).toEqual([
      "c",
      "d",
      "b",
      "e",
      "a",
    ]);
  });

  it.each([
    { name: "open and due yesterday", item: homework("x", "2026-10-28"), overdue: true },
    { name: "open and due today", item: homework("x", "2026-10-29"), overdue: false },
    {
      name: "done and due yesterday",
      item: homework("x", "2026-10-28", "2026-10-29"),
      overdue: false,
    },
  ])("marks homework that is $name as overdue: $overdue", ({ item, overdue }) => {
    expect(HomeworkDates.isOverdue(item, today)).toBe(overdue);
  });

  it.each([
    { name: "open, 7 days past due", item: homework("x", "2026-10-22"), dimmed: false },
    { name: "open, 8 days past due", item: homework("x", "2026-10-21"), dimmed: true },
    { name: "done, due tomorrow", item: homework("x", "2026-10-30", "2026-10-29"), dimmed: true },
  ])("dims homework that is $name: $dimmed", ({ item, dimmed }) => {
    expect(HomeworkDates.isDimmed(item, today)).toBe(dimmed);
  });

  it("offers due dates from today to 365 days ahead", () => {
    const { start, end } = HomeworkDates.dueDates(today);

    expect([start, end].map((day) => PlainDateFns.toString(day))).toEqual([
      "2026-10-29",
      "2027-10-29",
    ]);
  });

  it.each([
    { name: "open, of the course, due that day", course: "ma", dueOn: "2026-10-30", open: true },
    { name: "done", course: "ma", dueOn: "2026-10-30", doneOn: "2026-10-29", open: false },
    { name: "of another course", course: "de", dueOn: "2026-10-30", open: false },
    { name: "due the day before", course: "ma", dueOn: "2026-10-29", open: false },
    { name: "due the day after", course: "ma", dueOn: "2026-10-31", open: false },
  ])("says Mathematik on 30 October has homework open for one $name: $open", (row) => {
    const each = { ...homework("x", row.dueOn, row.doneOn), courseId: row.course };

    expect(HomeworkDates.isOpenFor([each], "ma", date("2026-10-30"))).toBe(row.open);
  });
});
