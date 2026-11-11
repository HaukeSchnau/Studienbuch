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
  title: id,
  dueOn: date(dueOn),
  doneOn: doneOn === undefined ? undefined : date(doneOn),
  course: Option.some({ name: "MA-E1" }),
  subject: Option.some({ name: "Mathematik", shortName: "MA" }),
});

describe("HomeworkItem", () => {
  it("lists open homework by due date, then done homework, and drops done homework a week after its due date", () => {
    const cards = HomeworkItem.panel(
      [
        homework("done, due last week", "2026-10-21", "2026-10-20"),
        homework("due friday", "2026-10-30"),
        homework("done, due 8 days ago", "2026-10-20", "2026-10-19"),
        homework("done, due friday", "2026-10-30", "2026-10-28"),
        homework("open, due 8 days ago", "2026-10-20"),
        homework("due tomorrow", "2026-10-29"),
        homework("due yesterday", "2026-10-27"),
      ],
      today,
    );

    expect(cards.map((card) => card.id)).toEqual([
      "open, due 8 days ago",
      "due yesterday",
      "due tomorrow",
      "due friday",
      "done, due last week",
      "done, due friday",
    ]);
  });

  it.each([
    ["2026-10-29", undefined, { overdue: false, dimmed: false, done: false, due: "Bis morgen" }],
    ["2026-10-28", undefined, { overdue: false, dimmed: false, done: false }],
    ["2026-10-27", undefined, { overdue: true, dimmed: false, done: false }],
    ["2026-10-20", undefined, { overdue: true, dimmed: true, done: false }],
    ["2026-10-27", "2026-10-28", { overdue: false, dimmed: true, done: true }],
  ])("colours homework due on %s and done on %s", (dueOn, doneOn, state) => {
    expect(HomeworkItem.make(homework("a", dueOn, doneOn), today)).toMatchObject(state);
  });

  it("names homework by its course when the school named no subject, and still finds its look", () => {
    const item = HomeworkItem.make(
      { ...homework("a", "2026-10-30"), subject: Option.none() },
      today,
    );

    expect(item).toMatchObject({ subject: "MA-E1", look: { slot: "blue", art: "ma" } });
  });
});
