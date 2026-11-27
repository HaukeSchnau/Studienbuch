import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";
import { CivilTime } from "../civil-time/CivilTime.ts";
import { Course } from "../school/Course.ts";
import type { Lesson } from "../school/Lesson.ts";
import { Room } from "../school/Room.ts";
import { School } from "../school/School.ts";
import { Teacher } from "../school/Teacher.ts";
import { Fixture } from "../testing/Fixture.ts";
import { Timetable } from "./Timetable.ts";

const { date } = Fixture;

/** "08:00" as a lesson's `start`. */
const at = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);

  return (hours * 60 + minutes) * 60_000;
};

const moment = (day: string, time: string): CivilTime.Moment => ({
  date: date(day),
  time: at(time),
});

interface Listed extends Timetable.Timed {
  readonly id: string;
}

/** A lesson as `"2026-11-18 09:50-11:20 ma"`, Mathematik with BRA in A101 unless `more` says otherwise. */
const lesson = (text: string, more: Partial<Timetable.Timed> = {}): Listed => {
  const [day = "", times = "", course = "ma"] = text.split(" ");
  const [start = "", end = ""] = times.split("-");

  return {
    id: text,
    courseId: Course.Id.make(course),
    date: date(day),
    start: at(start),
    end: at(end),
    teacherIds: [Teacher.Id.make("bra")],
    roomIds: [Room.Id.make("a101")],
    status: "Regular",
    ...more,
  };
};

const cancelled: Partial<Timetable.Timed> = {
  status: "Cancelled",
  change: { kind: "Cancelled", previousTeacherIds: [], previousRoomIds: [] },
};

const clock = (time: number) => {
  const minutes = time / 60_000;

  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

/** The rows of what the card shows, as `"Day 2026-11-18: ma 09:50, free 11:40"`. */
const describeShown = (shown: Timetable.Shown<Listed>) => {
  switch (shown._tag) {
    case "Day":
      return `Day ${CivilTime.format(shown.date)}: ${shown.rows
        .map((row) =>
          row._tag === "Lesson"
            ? `${row.lesson.courseId} ${clock(row.lesson.start)}-${clock(row.lesson.end)}`
            : `free ${clock(row.start)}-${clock(row.end)}`,
        )
        .join(", ")}`;
    case "Unpublished":
      return `Unpublished ${CivilTime.format(shown.date)}`;
    case "Closed":
      return `Closed ${shown.name} until ${CivilTime.format(shown.until)}, resumes ${CivilTime.format(shown.resumes)} with ${Option.match(
        shown.first,
        { onNone: () => "nothing known", onSome: (first) => first.courseId },
      )}`;
    case "None":
      return "None";
  }
};

// The mocks' week, KW 47: Monday 16 to Friday 20 November 2026.
const week: ReadonlyArray<Listed> = [
  lesson("2026-11-16 08:00-09:30 ma"),
  lesson("2026-11-16 09:50-11:20 de"),
  lesson("2026-11-17 08:00-09:30 en"),
  lesson("2026-11-17 13:50-14:35 sf"),
  lesson("2026-11-18 08:00-09:30 de"),
  lesson("2026-11-18 09:50-11:20 ma"),
  lesson("2026-11-18 11:40-13:10 bi"),
  lesson("2026-11-18 13:50-15:20 sp", cancelled),
  lesson("2026-11-19 08:00-09:30 ku"),
  lesson("2026-11-19 11:40-13:10 ge"),
  lesson("2026-11-20 08:00-09:30 ma"),
];

const plan = (more: Partial<Timetable.Plan<Listed>> = {}): Timetable.Plan<Listed> => ({
  lessons: week,
  closures: [],
  coveredUntil: date("2026-11-20"),
  ...more,
});

describe("Timetable.phase", () => {
  const math = lesson("2026-11-18 09:50-11:20 ma");

  it.each([
    { name: "before it starts", now: moment("2026-11-18", "09:49"), phase: "Later" },
    { name: "as it starts", now: moment("2026-11-18", "09:50"), phase: "Running" },
    { name: "as it ends", now: moment("2026-11-18", "11:20"), phase: "Over" },
    { name: "the day before", now: moment("2026-11-17", "12:00"), phase: "Later" },
    { name: "the day after", now: moment("2026-11-19", "08:00"), phase: "Over" },
  ])("puts a lesson $name: $phase", ({ now, phase }) => {
    expect(Timetable.phase(math, now)).toBe(phase);
  });

  it("never runs a lesson that is off", () => {
    const off = lesson("2026-11-18 09:50-11:20 ma", cancelled);

    expect(
      [moment("2026-11-18", "10:30"), moment("2026-11-18", "11:30")].map((now) =>
        Timetable.phase(off, now),
      ),
    ).toEqual(["Later", "Over"]);
  });

  it("counts the minute begun as left", () => {
    const math = lesson("2026-11-18 09:50-11:20 ma");

    expect([
      Timetable.minutesLeft(math, moment("2026-11-18", "10:30")),
      Timetable.minutesLeft(math, { date: date("2026-11-18"), time: at("11:19") + 30_000 }),
    ]).toEqual([50, 1]);
  });
});

describe("Timetable.change", () => {
  const changed = (kind: Lesson.ChangeKind, text?: string) => {
    const change = { kind, previousTeacherIds: [], previousRoomIds: [] };

    return text === undefined ? change : { ...change, text };
  };

  it.each([
    { name: "a regular lesson", status: "Regular", change: undefined, shown: "none" },
    {
      name: "a cancelled lesson",
      status: "Cancelled",
      change: changed("Cancelled"),
      shown: "Off Cancelled",
    },
    {
      name: "a cancelled lesson without a change",
      status: "Cancelled",
      change: undefined,
      shown: "Off Cancelled",
    },
    { name: "a release", status: "Changed", change: changed("Released"), shown: "Off Released" },
    {
      name: "a substitution",
      status: "Changed",
      change: changed("Substitution"),
      shown: "Note Substitution",
    },
    {
      name: "a room change",
      status: "Changed",
      change: changed("RoomChange"),
      shown: "Note RoomChange",
    },
    { name: "an added lesson", status: "Added", change: changed("Other"), shown: "Note Added" },
    {
      name: "another change with the school's phrase",
      status: "Changed",
      change: changed("Other", "Klausuraufsicht"),
      shown: "Note Other Klausuraufsicht",
    },
    { name: "another change", status: "Changed", change: changed("Other"), shown: "Note Other" },
  ] as const)("names $name: $shown", ({ status, change, shown: named }) => {
    const shown = Timetable.change(change === undefined ? { status } : { status, change });

    expect(
      Option.match(shown, {
        onNone: () => "none",
        onSome: Timetable.Change.$match({
          Off: ({ kind }) => `Off ${kind}`,
          Note: ({ kind, text }) => (text === undefined ? `Note ${kind}` : `Note ${kind} ${text}`),
        }),
      }),
    ).toBe(named);
  });
});

describe("Timetable.blocks", () => {
  const times = (lessons: ReadonlyArray<Listed>) =>
    lessons.map(({ courseId, start, end }) => `${courseId} ${clock(start)}-${clock(end)}`);

  it("joins the halves of a double period, up to 10 minutes apart", () => {
    expect(
      times(
        Timetable.blocks([
          lesson("2026-11-18 10:35-11:20 ma"),
          lesson("2026-11-18 09:50-10:35 ma"),
          lesson("2026-11-18 08:00-08:45 de"),
          lesson("2026-11-18 08:55-09:40 de"),
          lesson("2026-11-18 11:40-12:25 bi"),
          lesson("2026-11-18 12:40-13:25 bi"),
        ]),
      ),
    ).toEqual(["de 08:00-09:40", "ma 09:50-11:20", "bi 11:40-12:25", "bi 12:40-13:25"]);
  });

  it("keeps a block split by a change as two lessons", () => {
    expect(
      times(
        Timetable.blocks([
          lesson("2026-11-18 09:50-10:35 ma"),
          lesson("2026-11-18 10:35-11:20 ma", cancelled),
          lesson("2026-11-18 11:40-12:25 bi"),
          lesson("2026-11-18 12:25-13:10 bi", { roomIds: [Room.Id.make("nw3")] }),
        ]),
      ),
    ).toEqual(["ma 09:50-10:35", "ma 10:35-11:20", "bi 11:40-12:25", "bi 12:25-13:10"]);
  });

  it("joins no lessons of different courses or days", () => {
    expect(
      times(
        Timetable.blocks([
          lesson("2026-11-18 09:50-10:35 ma"),
          lesson("2026-11-18 10:35-11:20 de"),
          lesson("2026-11-19 10:35-11:20 ma"),
        ]),
      ),
    ).toEqual(["ma 09:50-10:35", "de 10:35-11:20", "ma 10:35-11:20"]);
  });
});

describe("Timetable.shown", () => {
  it.each([
    {
      name: "today while a lesson is ahead, with a free period at a start the week uses and none at lunch",
      plan: plan({ lessons: week.filter(({ id }) => !id.includes("09:50-11:20 ma")) }),
      now: moment("2026-11-18", "10:30"),
      shown: "Day 2026-11-18: de 08:00-09:30, free 09:50-11:20, bi 11:40-13:10, sp 13:50-15:20",
    },
    {
      name: "the next day in the evening, once the lesson after the last is cancelled",
      plan: plan(),
      now: moment("2026-11-18", "13:10"),
      shown: "Day 2026-11-19: ku 08:00-09:30, free 09:50-11:20, ge 11:40-13:10",
    },
    {
      name: "the day itself after midnight",
      plan: plan(),
      now: moment("2026-11-19", "00:30"),
      shown: "Day 2026-11-19: ku 08:00-09:30, free 09:50-11:20, ge 11:40-13:10",
    },
    {
      name: "a day whose lessons are all off until its first lesson starts",
      plan: plan({
        lessons: [
          lesson("2026-11-18 08:00-09:30 de", cancelled),
          lesson("2026-11-19 08:00-09:30 ku"),
        ],
      }),
      now: moment("2026-11-18", "07:30"),
      shown: "Day 2026-11-18: de 08:00-09:30",
    },
    {
      name: "Monday after the last lesson on Friday",
      plan: plan({
        lessons: [...week, lesson("2026-11-23 08:00-09:30 ma")],
        coveredUntil: date("2026-11-27"),
      }),
      now: moment("2026-11-20", "16:00"),
      shown: "Day 2026-11-23: ma 08:00-09:30",
    },
    {
      name: "the first day after a closure",
      plan: plan({
        lessons: [
          ...week,
          lesson("2026-11-23 08:00-09:30 ma"),
          lesson("2026-11-24 08:00-09:30 de"),
        ],
        closures: [
          {
            name: "Brückentag",
            dates: [{ start: date("2026-11-23"), end: date("2026-11-23") }],
          },
        ],
        coveredUntil: date("2026-11-27"),
      }),
      now: moment("2026-11-20", "16:00"),
      shown: "Day 2026-11-24: de 08:00-09:30",
    },
    {
      name: "the closure, with the day school resumes and its first lesson that takes place",
      plan: plan({
        lessons: [
          lesson("2027-01-11 08:00-09:30 de", cancelled),
          lesson("2027-01-11 09:50-11:20 ma"),
        ],
        closures: [
          {
            name: "Weihnachtsferien",
            dates: [{ start: date("2026-12-23"), end: date("2027-01-09") }],
          },
        ],
        coveredUntil: date("2027-01-15"),
      }),
      now: moment("2026-12-28", "10:00"),
      shown: "Closed Weihnachtsferien until 2027-01-09, resumes 2027-01-11 with ma",
    },
    {
      name: "the closure, and nothing of the day school resumes before it is published",
      plan: plan({
        lessons: [lesson("2027-01-11 08:00-09:30 ma")],
        closures: [
          {
            name: "Weihnachtsferien",
            dates: [{ start: date("2026-12-23"), end: date("2027-01-09") }],
          },
        ],
        coveredUntil: date("2027-01-08"),
      }),
      now: moment("2026-12-28", "10:00"),
      shown: "Closed Weihnachtsferien until 2027-01-09, resumes 2027-01-11 with nothing known",
    },
    {
      name: "a free period at a single period's start, though the week joins it into a double",
      plan: plan({
        lessons: [
          lesson("2026-11-16 08:00-08:45 ma"),
          lesson("2026-11-16 08:50-09:35 ma"),
          lesson("2026-11-17 08:00-08:45 de"),
          lesson("2026-11-17 09:40-10:25 en"),
        ],
      }),
      now: moment("2026-11-17", "07:30"),
      shown: "Day 2026-11-17: de 08:00-08:45, free 08:50-09:35, en 09:40-10:25",
    },
    {
      name: "free periods that end at the next start, so none overlaps another",
      plan: plan({
        lessons: [
          lesson("2026-11-16 08:00-09:30 ma"),
          lesson("2026-11-17 08:45-09:30 de"),
          lesson("2026-11-18 07:15-08:00 en"),
          lesson("2026-11-18 09:45-10:30 bi"),
        ],
      }),
      now: moment("2026-11-18", "07:00"),
      shown: "Day 2026-11-18: en 07:15-08:00, free 08:00-08:45, free 08:45-09:30, bi 09:45-10:30",
    },
    {
      name: "no free period at a start only lessons after the last day published use",
      plan: plan({
        lessons: [
          lesson("2026-11-18 08:00-09:30 de"),
          lesson("2026-11-18 11:40-13:10 bi"),
          lesson("2026-11-19 09:50-11:20 ma"),
        ],
        coveredUntil: date("2026-11-18"),
      }),
      now: moment("2026-11-18", "07:30"),
      shown: "Day 2026-11-18: de 08:00-09:30, bi 11:40-13:10",
    },
    {
      name: "the closure, though the device still holds a lesson of it",
      plan: plan({
        lessons: [lesson("2026-11-18 09:50-11:20 ma"), lesson("2026-11-19 08:00-09:30 ku")],
        closures: [
          { name: "Studientag", dates: [{ start: date("2026-11-18"), end: date("2026-11-18") }] },
        ],
      }),
      now: moment("2026-11-18", "08:00"),
      shown: "Closed Studientag until 2026-11-18, resumes 2026-11-19 with ku",
    },
    {
      name: "today after the last day published, though the device still holds a lesson of it",
      plan: plan({ lessons: [...week, lesson("2026-11-23 08:00-09:30 ma")] }),
      now: moment("2026-11-23", "07:00"),
      shown: "Unpublished 2026-11-23",
    },
    {
      name: "the first school day after the last one published",
      plan: plan({ lessons: [...week, lesson("2026-11-23 08:00-09:30 ma")] }),
      now: moment("2026-11-20", "16:00"),
      shown: "Unpublished 2026-11-23",
    },
    {
      name: "today when the Stand stopped before it",
      plan: plan(),
      now: moment("2026-11-23", "07:00"),
      shown: "Unpublished 2026-11-23",
    },
    {
      name: "nothing without a lesson ahead or a Stand",
      plan: plan({ coveredUntil: undefined }),
      now: moment("2026-11-20", "16:00"),
      shown: "None",
    },
  ])("shows $name", ({ plan, now, shown }) => {
    expect(describeShown(Timetable.shown(plan, now))).toBe(shown);
  });
});

describe("Timetable.nextLesson", () => {
  const friday = (more: Partial<Timetable.Timed> = {}) => [
    ...week.filter(({ id }) => id !== "2026-11-20 08:00-09:30 ma"),
    lesson("2026-11-20 08:00-09:30 ma", more),
    lesson("2026-11-23 08:00-09:30 ma"),
  ];

  const nextWeek = { coveredUntil: date("2026-11-27") };

  it.each([
    {
      name: "the course's next lesson",
      plan: plan(),
      next: "2026-11-20 08:00-09:30 ma",
    },
    {
      name: "one on a later day, not a lesson later the same day",
      plan: plan({ lessons: [...week, lesson("2026-11-18 13:50-14:35 ma")] }),
      next: "2026-11-20 08:00-09:30 ma",
    },
    {
      name: "past a cancelled lesson",
      plan: plan({ lessons: friday(cancelled), ...nextWeek }),
      next: "2026-11-23 08:00-09:30 ma",
    },
    {
      name: "past a released one",
      plan: plan({
        lessons: friday({
          status: "Changed",
          change: { kind: "Released", previousTeacherIds: [], previousRoomIds: [] },
        }),
        ...nextWeek,
      }),
      next: "2026-11-23 08:00-09:30 ma",
    },
    {
      name: "past a closure",
      plan: plan({
        lessons: friday(),
        closures: [
          {
            name: "Brückentag",
            dates: [{ start: date("2026-11-20"), end: date("2026-11-20") }],
          },
        ],
        ...nextWeek,
      }),
      next: "2026-11-23 08:00-09:30 ma",
    },
    {
      name: "none past the last day published",
      plan: plan({ lessons: friday(cancelled) }),
      next: "none",
    },
    {
      name: "one from today on, when the lesson after has passed",
      plan: plan(),
      after: "2026-11-16",
      today: "2026-11-20",
      next: "2026-11-20 08:00-09:30 ma",
    },
  ])("finds $name", ({ plan: held, after = "2026-11-18", today = "2026-11-18", next }) => {
    expect(
      Option.match(Timetable.nextLesson(held, Course.Id.make("ma"), date(after), date(today)), {
        onNone: () => "none",
        onSome: ({ id }) => id,
      }),
    ).toBe(next);
  });
});

/** A week's columns as `"Mo: de 08:00-09:30 1/2, ma 08:45-09:30 2/2"`, `"Mi: Ferien until 2026-11-20"`. */
const describeWeek = (week: Timetable.Week<Listed>) => {
  const names = ["Mo", "Di", "Mi", "Do", "Fr", "Sa"];

  const columns = week.columns.map((column) => {
    const name = names[CivilTime.dayOfWeek(column.date) - 1] ?? "";

    switch (column._tag) {
      case "Open":
        return `${name}: ${column.lessons
          .map(
            ({ lesson, lane, lanes }) =>
              `${lesson.courseId} ${clock(lesson.start)}-${clock(lesson.end)}${
                lanes === 1 ? "" : ` ${String(lane + 1)}/${String(lanes)}`
              }`,
          )
          .join(", ")}`;
      case "Closed":
        return `${name}: ${column.name} until ${CivilTime.format(column.until)}`;
      case "Unpublished":
        return `${name}: unpublished`;
    }
  });

  const hours = Option.match(week.hours, {
    onNone: () => "no hours",
    onSome: ({ start, end, starts }) =>
      `${clock(start)}-${clock(end)} at ${starts.map(clock).join(" ")}`,
  });

  return [...columns, hours];
};

describe("Timetable.week", () => {
  const monday = date("2026-11-16");

  it("draws Monday to Friday with the week's hours, labelled at each start", () => {
    expect(describeWeek(Timetable.week(plan(), monday))).toEqual([
      "Mo: ma 08:00-09:30, de 09:50-11:20",
      "Di: en 08:00-09:30, sf 13:50-14:35",
      "Mi: de 08:00-09:30, ma 09:50-11:20, bi 11:40-13:10, sp 13:50-15:20",
      "Do: ku 08:00-09:30, ge 11:40-13:10",
      "Fr: ma 08:00-09:30",
      "08:00-15:20 at 08:00 09:50 11:40 13:50",
    ]);
  });

  it.each([
    {
      name: "joins double periods and puts overlapping lessons side by side",
      plan: plan({
        lessons: [
          lesson("2026-11-16 08:00-08:45 ma"),
          lesson("2026-11-16 08:45-09:30 ma"),
          lesson("2026-11-16 08:00-08:45 de"),
          lesson("2026-11-16 08:45-09:30 bi"),
          lesson("2026-11-16 09:50-11:20 en"),
          lesson("2026-11-16 09:50-10:35 ge"),
          lesson("2026-11-16 10:35-11:20 ku"),
        ],
      }),
      week: [
        "Mo: de 08:00-08:45 1/2, ma 08:00-09:30 2/2, bi 08:45-09:30 1/2, en 09:50-11:20 1/2, ge 09:50-10:35 2/2, ku 10:35-11:20 2/2",
        "Di: ",
        "Mi: ",
        "Do: ",
        "Fr: ",
        "08:00-11:20 at 08:00 08:45 09:50 10:35",
      ],
    },
    {
      name: "adds Saturday only when a lesson takes place on it",
      plan: plan({
        lessons: [
          lesson("2026-11-16 08:00-09:30 ma"),
          lesson("2026-11-21 09:50-11:20 sp"),
          lesson("2026-11-22 07:00-08:00 de"),
        ],
        coveredUntil: date("2026-11-27"),
      }),
      week: [
        "Mo: ma 08:00-09:30",
        "Di: ",
        "Mi: ",
        "Do: ",
        "Fr: ",
        "Sa: sp 09:50-11:20",
        "08:00-11:20 at 08:00 09:50",
      ],
    },
    {
      name: "closes the days of a closure and hides what the device still holds for them",
      plan: plan({
        closures: [
          {
            name: "Weihnachtsferien",
            dates: [{ start: date("2026-11-18"), end: date("2027-01-09") }],
          },
        ],
      }),
      week: [
        "Mo: ma 08:00-09:30, de 09:50-11:20",
        "Di: en 08:00-09:30, sf 13:50-14:35",
        "Mi: Weihnachtsferien until 2027-01-09",
        "Do: Weihnachtsferien until 2027-01-09",
        "Fr: Weihnachtsferien until 2027-01-09",
        "08:00-14:35 at 08:00 09:50 13:50",
      ],
    },
    {
      name: "marks the days after the last one published, lessons or not",
      plan: plan({ coveredUntil: date("2026-11-18") }),
      week: [
        "Mo: ma 08:00-09:30, de 09:50-11:20",
        "Di: en 08:00-09:30, sf 13:50-14:35",
        "Mi: de 08:00-09:30, ma 09:50-11:20, bi 11:40-13:10, sp 13:50-15:20",
        "Do: unpublished",
        "Fr: unpublished",
        "08:00-15:20 at 08:00 09:50 11:40 13:50",
      ],
    },
    {
      name: "has no hours in a week without lessons",
      plan: plan({ coveredUntil: date("2026-11-13") }),
      week: [
        "Mo: unpublished",
        "Di: unpublished",
        "Mi: unpublished",
        "Do: unpublished",
        "Fr: unpublished",
        "no hours",
      ],
    },
  ])("$name", ({ plan, week }) => {
    expect(describeWeek(Timetable.week(plan, monday))).toEqual(week);
  });

  it("keeps the halves of double periods apart for the day list's free periods", () => {
    const halves = [lesson("2026-11-16 08:00-08:45 ma"), lesson("2026-11-16 08:45-09:30 ma")];

    expect(Timetable.week(plan({ lessons: halves }), monday).published).toEqual(halves);
  });
});

describe("Timetable.schoolWeek", () => {
  it.each([
    { day: "2026-11-16", monday: "2026-11-16" },
    { day: "2026-11-20", monday: "2026-11-16" },
    { day: "2026-11-21", monday: "2026-11-23" },
    { day: "2026-11-22", monday: "2026-11-23" },
  ])("opens $monday on $day", ({ day, monday }) => {
    expect(CivilTime.format(Timetable.schoolWeek(date(day)))).toBe(monday);
  });
});

describe("Timetable.staleSince", () => {
  const zone = School.defaultTimeZone;
  // 18 November 2026 in Berlin is UTC+1.
  const berlin = (day: string, time: string) => Date.parse(`${day}T${time}:00+01:00`);

  it.each([
    {
      name: "is quiet up to an hour",
      read: berlin("2026-11-18", "09:30"),
      now: berlin("2026-11-18", "10:30"),
      stale: "fresh",
    },
    {
      name: "says when it read after an hour",
      read: berlin("2026-11-18", "09:29"),
      now: berlin("2026-11-18", "10:30"),
      stale: "2026-11-18 09:29",
    },
    {
      name: "is quiet at night, when the import sleeps",
      read: berlin("2026-11-18", "20:50"),
      now: berlin("2026-11-18", "22:00"),
      stale: "fresh",
    },
    {
      name: "is quiet until 06:30",
      read: berlin("2026-11-18", "21:50"),
      now: berlin("2026-11-19", "06:29"),
      stale: "fresh",
    },
    {
      name: "says yesterday's read from 06:30",
      read: berlin("2026-11-18", "21:50"),
      now: berlin("2026-11-19", "06:30"),
      stale: "2026-11-18 21:50",
    },
    {
      // The clocks go forward at 02:00 on 29 March 2026, so 05:20 to 06:30 on the wall is 10 minutes.
      name: "counts the time that passed, not the wall clock, on the day the clocks go forward",
      read: Date.parse("2026-03-29T05:20:00+01:00"),
      now: Date.parse("2026-03-29T06:30:00+02:00"),
      stale: "fresh",
    },
  ])("$name", ({ read, now, stale }) => {
    expect(
      Option.match(Timetable.staleSince(read, School.now({ timeZone: zone }, now)), {
        onNone: () => "fresh",
        onSome: ({ date, time }) => `${CivilTime.format(date)} ${clock(time)}`,
      }),
    ).toBe(stale);
  });
});
