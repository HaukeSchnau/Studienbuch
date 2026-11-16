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

  it("lists every open homework by due date, then every done one by when it was ticked, the latest first", () => {
    const { open, done } = HomeworkItem.list(
      [
        homework("done-in-september", "2026-09-10", "2026-09-09"),
        homework("next-week", "2026-11-04"),
        homework("done-yesterday", "2026-10-30", "2026-10-27"),
        homework("forgotten", "2026-10-01"),
        homework("b-same-day", "2026-10-29"),
        homework("a-same-day", "2026-10-29"),
        homework("done-last-week", "2026-10-21", "2026-10-21"),
        // Ticked today though long overdue, and ticked last week though due next month.
        homework("late-done-today", "2026-10-01", "2026-10-28"),
        homework("early-done-last-week", "2026-11-20", "2026-10-21"),
      ],
      today,
    );

    expect(open.map((item) => item.id)).toEqual([
      "forgotten",
      "a-same-day",
      "b-same-day",
      "next-week",
    ]);
    expect(done.map((item) => item.id)).toEqual([
      "late-done-today",
      "done-yesterday",
      "early-done-last-week",
      "done-last-week",
      "done-in-september",
    ]);
  });

  it.each([
    ["open", homework("a", "2026-10-30"), "Noch offen"],
    ["overdue", homework("a", "2026-10-26"), "Überfällig seit Montag"],
    ["done", homework("a", "2026-10-30", "2026-10-27"), "Erledigt am Dienstag, 27. Oktober"],
    [
      "done last year",
      homework("a", "2025-12-20", "2025-12-19"),
      "Erledigt am Freitag, 19. Dezember 2025",
    ],
  ])("names the state of %s homework on its page", (_, source, state) => {
    expect(HomeworkItem.detail({ ...source, description: undefined }, today).state).toBe(state);
  });

  it("names and marks a course without a subject by the course", () => {
    const item = HomeworkItem.make(
      { ...homework("a", "2026-10-30"), course: "MA-E1", subject: Option.none() },
      today,
    );

    expect([item.subject, item.mark.slot, item.mark.art]).toEqual(["MA-E1", "blue", "math"]);
  });
});
