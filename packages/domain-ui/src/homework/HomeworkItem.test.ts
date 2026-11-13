import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";

import { HomeworkItem } from "./HomeworkItem.ts";

const date = (iso: string) => PlainDateFns.fromString(iso, Calendar.getISO);

// Wednesday, 28 October 2026.
const today = date("2026-10-28");

const homework = (id: string, dueOn: string, doneOn?: string): HomeworkItem.Source => ({
  id,
  dueOn: date(dueOn),
  doneOn: doneOn === undefined ? undefined : date(doneOn),
  title: id,
  course: "MA-1",
  subject: Option.some({ name: "Mathematik", shortName: "MA" }),
  waiting: false,
});

describe("HomeworkItem", () => {
  it("shows open homework by due date, then done homework until a week after its due date or its tick", () => {
    const shown = HomeworkItem.panel(
      [
        homework("next-week", "2026-11-04"),
        homework("done-early", "2026-11-02", "2026-10-27"),
        homework("done-a-week-ago", "2026-10-21", "2026-10-21"),
        homework("done-eight-days-ago", "2026-10-20", "2026-10-20"),
        homework("forgotten", "2026-10-01"),
        homework("forgotten-done-today", "2026-10-02", "2026-10-28"),
        homework("forgotten-done-eight-days-ago", "2026-10-03", "2026-10-20"),
        homework("today", "2026-10-28"),
      ],
      today,
    );

    expect(shown.map((item) => [item.id, item.overdue, item.dimmed])).toEqual([
      ["forgotten", true, true],
      ["today", false, false],
      ["next-week", false, false],
      ["forgotten-done-today", false, true],
      ["done-a-week-ago", false, true],
      ["done-early", false, true],
    ]);
  });

  it("names and marks a course without a subject by the course", () => {
    const item = HomeworkItem.make(
      { ...homework("a", "2026-10-30"), course: "MA-E1", subject: Option.none() },
      today,
    );

    expect([item.subject, item.mark.slot, item.mark.art]).toEqual(["MA-E1", "blue", "math"]);
  });
});
