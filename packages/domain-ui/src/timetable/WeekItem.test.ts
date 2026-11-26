import { describe, expect, it } from "@effect/vitest";
import { type CivilTime, Course, Room, Teacher, Timetable } from "@stu/core";
import * as Option from "effect/Option";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";

import type { AgendaItem } from "./AgendaItem.ts";
import { WeekItem } from "./WeekItem.ts";

const date = (iso: string) => PlainDateFns.fromString(iso, Calendar.getISO);

/** "08:00" as a lesson's `start`. */
const at = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);

  return (hours * 60 + minutes) * 60_000;
};

const moment = (day: string, time: string): CivilTime.Moment => ({
  date: date(day),
  time: at(time),
});

// The mocks' week, KW 47.
const monday = date("2026-11-16");

const names: AgendaItem.Names = {
  teachers: new Map([["bra", "Brandt"]]),
  rooms: new Map([["a101", "A101"]]),
};

/** A lesson as `"2026-11-18 09:50-11:20"`, Mathematik with Brandt in A101. */
const lesson = (text: string, more: Partial<AgendaItem.Source> = {}): AgendaItem.Source => {
  const [day = "", times = ""] = text.split(" ");
  const [start = "", end = ""] = times.split("-");

  return {
    id: text,
    courseId: Course.Id.make("ma"),
    course: "MA-1",
    subject: Option.some({ name: "Mathematik", shortName: "MA" }),
    date: date(day),
    start: at(start),
    end: at(end),
    teacherIds: [Teacher.Id.make("bra")],
    roomIds: [Room.Id.make("a101")],
    status: "Regular",
    ...more,
  };
};

const plan = (
  more: Partial<Timetable.Plan<AgendaItem.Source>> = {},
): Timetable.Plan<AgendaItem.Source> => ({
  lessons: [lesson("2026-11-16 08:00-09:30"), lesson("2026-11-18 09:50-11:20")],
  closures: [],
  coveredUntil: date("2026-11-20"),
  ...more,
});

const ferien = (name: string, start: string, end: string) => ({
  name,
  dates: [{ start: date(start), end: date(end) }],
});

describe("WeekItem.week", () => {
  it.each([
    {
      name: "joins neighbouring days of one closure, and of the days not published",
      plan: plan({
        closures: [ferien("Brückentag", "2026-11-17", "2026-11-17")],
        coveredUntil: date("2026-11-18"),
      }),
      spans: ["closure 1-1 Brückentag bis Di, 17. November", "unpublished 3-4"],
    },
    {
      name: "keeps two closures that meet apart",
      plan: plan({
        closures: [
          ferien("Studientag", "2026-11-18", "2026-11-18"),
          ferien("Weihnachtsferien", "2026-11-19", "2027-01-09"),
        ],
      }),
      spans: [
        "closure 2-2 Studientag bis Mi, 18. November",
        "closure 3-4 Weihnachtsferien bis Sa, 9. Januar",
      ],
    },
  ])("$name", ({ plan, spans }) => {
    const shown = WeekItem.week(Timetable.week(plan, monday), names, moment("2026-11-16", "10:00"));

    expect(
      shown.spans.map((span) =>
        span.kind === "closure"
          ? `closure ${String(span.from)}-${String(span.to)} ${span.name} ${span.until}`
          : `unpublished ${String(span.from)}-${String(span.to)}`,
      ),
    ).toEqual(spans);
  });

  it.each([
    {
      name: "in today's column while lessons run",
      now: moment("2026-11-18", "10:30"),
      line: { day: 2, time: at("10:30") },
    },
    { name: "none before the first start", now: moment("2026-11-18", "07:59"), line: undefined },
    { name: "none after the last end", now: moment("2026-11-18", "11:21"), line: undefined },
    { name: "none in another week", now: moment("2026-11-23", "10:30"), line: undefined },
    {
      name: "none on a closed day",
      now: moment("2026-11-17", "10:30"),
      plan: plan({ closures: [ferien("Brückentag", "2026-11-17", "2026-11-17")] }),
      line: undefined,
    },
  ])("draws the line at now $name", ({ now, plan: given, line }) => {
    expect(WeekItem.week(Timetable.week(given ?? plan(), monday), names, now).now).toEqual(line);
  });

  it("writes a cell's subject short, or the course's name without a subject", () => {
    const shown = WeekItem.week(
      Timetable.week(
        plan({
          lessons: [
            lesson("2026-11-16 08:00-09:30"),
            lesson("2026-11-17 08:00-09:30", { course: "AST-1", subject: Option.none() }),
          ],
        }),
        monday,
      ),
      names,
      moment("2026-11-16", "10:00"),
    );

    expect(shown.cells.map((cell) => [cell.subject, cell.short])).toEqual([
      ["Mathematik", "Mathe"],
      ["AST-1", "AST-1"],
    ]);
  });
});

describe("WeekItem words", () => {
  it.each([
    { label: "A", chips: ["KW 47", "A-Woche"] },
    { label: "Woche 2", chips: ["KW 47", "Woche 2"] },
    { label: undefined, chips: ["KW 47"] },
  ])("chips for the label $label", ({ label, chips }) => {
    expect(WeekItem.chips(monday, label)).toEqual(chips);
  });

  it.each([
    { monday: "2026-11-16", days: 5, heading: "16.–20. November" },
    { monday: "2026-11-16", days: 6, heading: "16.–21. November" },
    { monday: "2026-11-30", days: 5, heading: "30. November – 4. Dezember" },
    { monday: "2026-12-28", days: 5, heading: "28. Dezember – 1. Januar" },
  ])("heads the week from $monday as $heading", ({ monday: first, days, heading }) => {
    expect(WeekItem.heading(date(first), days)).toBe(heading);
  });
});
