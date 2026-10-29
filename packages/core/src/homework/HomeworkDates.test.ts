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
});
