import { describe, expect, it } from "@effect/vitest";
import { type CivilTime, Course, type Lesson, Room, Teacher, Timetable } from "@stu/core";
import * as Option from "effect/Option";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";

import { AgendaItem } from "./AgendaItem.ts";

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

// Wednesday, 18 November 2026, the mocks' day.
const wednesday = "2026-11-18";

const names: AgendaItem.Names = {
  teachers: new Map([
    ["bra", "Brandt"],
    ["vos", "Voss"],
  ]),
  rooms: new Map([
    ["a101", "A101"],
    ["nw1", "NW1"],
    ["nw3", "NW3"],
  ]),
};

/** Mathematik from 09:50 to 11:20 with Brandt in A101, unless `more` says otherwise. */
const lesson = (more: Partial<AgendaItem.Source> = {}): AgendaItem.Source => ({
  id: "ma",
  courseId: Course.Id.make("ma"),
  course: "MA-1",
  subject: Option.some({ name: "Mathematik", shortName: "MA" }),
  date: date(wednesday),
  start: at("09:50"),
  end: at("11:20"),
  teacherIds: [Teacher.Id.make("bra")],
  roomIds: [Room.Id.make("a101")],
  status: "Regular",
  ...more,
});

const changed = (
  kind: Lesson.ChangeKind,
  previous: { readonly teachers?: ReadonlyArray<string>; readonly rooms?: ReadonlyArray<string> },
  text?: string,
): Pick<AgendaItem.Source, "status" | "change"> => {
  const change = {
    kind,
    previousTeacherIds: (previous.teachers ?? []).map((id) => Teacher.Id.make(id)),
    previousRoomIds: (previous.rooms ?? []).map((id) => Room.Id.make(id)),
  };

  return {
    status: kind === "Cancelled" ? "Cancelled" : "Changed",
    change: text === undefined ? change : { ...change, text },
  };
};

const day = (on: string, rows: ReadonlyArray<Timetable.Row<AgendaItem.Source>> = []) =>
  Timetable.Shown.Day({ date: date(on), rows });

describe("AgendaItem", () => {
  it("dims a lesson that is over, counts down the running one, and leaves a later one as it is", () => {
    const word = (time: string) => {
      const item = AgendaItem.lesson(lesson(), names, moment(wednesday, time), []);

      return item.kind === "lesson" ? [item.time, item.phase, item.remaining] : [];
    };

    expect([word("09:00"), word("09:50"), word("10:30"), word("11:19"), word("11:20")]).toEqual([
      ["09:50–11:20", "later", undefined],
      ["09:50–11:20", "now", "Noch 90 Minuten"],
      ["09:50–11:20", "now", "Noch 50 Minuten"],
      ["09:50–11:20", "now", "Noch 1 Minute"],
      ["09:50–11:20", "past", undefined],
    ]);
  });

  it("says Hausaufgabe offen on a lesson ahead whose course has homework due that day", () => {
    const homework = [
      { id: "h", courseId: "ma", dueOn: date(wednesday) },
      { id: "g", courseId: "de", dueOn: date("2026-11-19") },
    ];

    const open = (source: Partial<AgendaItem.Source>, time: string) => {
      const item = AgendaItem.lesson(lesson(source), names, moment(wednesday, time), homework);

      return item.kind === "lesson" && item.homework === true;
    };

    expect([
      open({}, "08:00"),
      open({}, "10:30"),
      open({}, "11:20"),
      open({ courseId: Course.Id.make("de") }, "08:00"),
      open({ courseId: Course.Id.make("de"), date: date("2026-11-19") }, "08:00"),
    ]).toEqual([true, true, false, false, true]);
  });

  it("writes out a lesson's sheet: its day, the change with what it replaced, the phrase, and the next lesson", () => {
    const sheet = (source: Partial<AgendaItem.Source>, next = Option.none<AgendaItem.Source>()) => {
      const { when, note, off, phrase, due } = AgendaItem.detail(
        lesson(source),
        names,
        next,
        date(wednesday),
      );

      return { when, note, off, phrase, due };
    };

    expect(
      sheet(
        { teacherIds: [Teacher.Id.make("vos")], ...changed("Substitution", { teachers: ["bra"] }) },
        Option.some(lesson({ date: date("2026-11-20"), start: at("08:00") })),
      ),
    ).toEqual({
      when: "Mittwoch, 18. November · 09:50–11:20",
      note: "Vertretung: Voss statt Brandt",
      off: undefined,
      phrase: undefined,
      due: "Fällig zur nächsten Stunde: Fr, 20.11., 08:00",
    });

    expect([
      sheet({ roomIds: [Room.Id.make("nw3")], ...changed("RoomChange", { rooms: ["nw1"] }) }).note,
      sheet({ teacherIds: [], ...changed("Substitution", { teachers: ["bra"] }) }).note,
      sheet(changed("Other", {}, "Exkursion")).phrase,
      sheet(changed("Moved", {}, "Exkursion")).phrase,
      sheet(changed("Substitution", { teachers: ["bra"] }, "Vertretung")).phrase,
      sheet(changed("Cancelled", {}, "Klassenfahrt")).off,
      sheet({}).due,
    ]).toEqual([
      "Raumänderung: NW3 statt NW1",
      "Vertretung",
      undefined,
      "Exkursion",
      undefined,
      "Entfall",
      "Die nächste Stunde steht noch nicht im Plan.",
    ]);
  });

  it("names a change in the note, or beside the subject it strikes", () => {
    const word = (source: Partial<AgendaItem.Source>) => {
      const item = AgendaItem.lesson(lesson(source), names, moment(wednesday, "08:00"), []);

      return item.kind === "lesson" ? `${item.note ?? "-"} / ${item.off ?? "-"}` : "";
    };

    expect([
      word({}),
      word(changed("Cancelled", {})),
      word({ status: "Cancelled" }),
      word(changed("Released", {})),
      word(changed("Substitution", { teachers: ["bra"] })),
      word(changed("Supervised", {})),
      word(changed("RoomChange", { rooms: ["nw1"] })),
      word(changed("Moved", {})),
      word({ status: "Added", change: changed("Other", {}).change }),
      word(changed("Other", {}, "Exkursion")),
      word(changed("Other", {})),
    ]).toEqual([
      "- / -",
      "- / Entfall",
      "- / Entfall",
      "- / Freisetzung",
      "Vertretung / -",
      "Betreuung / -",
      "Raumänderung / -",
      "Verlegt / -",
      "Zusätzlich / -",
      "Exkursion / -",
      "Geändert / -",
    ]);
  });

  it("shows a teacher or room that changed beside the one before, and leaves out unknown ids", () => {
    const who = (source: Partial<AgendaItem.Source>) => {
      const item = AgendaItem.lesson(lesson(source), names, moment(wednesday, "08:00"), []);

      return item.kind === "lesson" ? { teacher: item.teacher, room: item.room } : {};
    };

    expect(who({})).toEqual({ teacher: { now: "Brandt" }, room: { now: "A101" } });

    expect(
      who({
        teacherIds: [Teacher.Id.make("vos")],
        ...changed("Substitution", { teachers: ["bra"] }),
      }),
    ).toEqual({ teacher: { now: "Voss", was: "Brandt" }, room: { now: "A101" } });

    expect(
      who({ roomIds: [Room.Id.make("nw3")], ...changed("RoomChange", { rooms: ["nw1"] }) }),
    ).toEqual({ teacher: { now: "Brandt" }, room: { now: "NW3", was: "NW1" } });

    // Supervision without a teacher named, and a room the device doesn't know.
    expect(
      who({
        teacherIds: [],
        roomIds: [Room.Id.make("gone")],
        ...changed("Supervised", { teachers: ["bra"] }),
      }),
    ).toEqual({ teacher: { now: "", was: "Brandt" }, room: undefined });
  });

  it("heads the card with the day it shows, and fills a free period", () => {
    const heading = (on: string) =>
      AgendaItem.agenda(day(on), names, moment(wednesday, "16:00"), []).heading;

    expect(
      [wednesday, "2026-11-19", "2026-11-23", "2026-11-25", "2027-01-04"].map(heading),
    ).toEqual([
      "Das steht heute an:",
      "Das steht morgen an:",
      "Das steht am Montag an:",
      "Das steht am Mi, 25.11. an:",
      "Das steht am Mo, 4.1.2027 an:",
    ]);

    const rows = AgendaItem.agenda(
      day(wednesday, [Timetable.Row.Free({ start: at("11:40"), end: at("13:10") })]),
      names,
      moment(wednesday, "08:00"),
      [],
    ).card?.items;

    expect(rows).toEqual([{ kind: "free", id: "free-42000000", time: "11:40–13:10" }]);
  });

  it("says when the school hasn't published the next school day yet", () => {
    const unpublished = (on: string) =>
      AgendaItem.agenda(
        Timetable.Shown.Unpublished({ date: date(on) }),
        names,
        moment(wednesday, "16:00"),
        [],
      );

    expect(unpublished("2026-11-23")).toEqual({
      heading: "Das steht am Montag an:",
      card: { items: [], notice: { lines: ["Für Montag ist noch nichts veröffentlicht."] } },
    });

    expect(unpublished("2026-11-19").card?.notice?.lines).toEqual([
      "Für morgen ist noch nichts veröffentlicht.",
    ]);
  });

  it("wishes happy holidays, and says when and how school resumes", () => {
    const closed = (
      today: string,
      name: string,
      until: string,
      resumes: string,
      first: Option.Option<AgendaItem.Source>,
    ) =>
      AgendaItem.agenda(
        Timetable.Shown.Closed({ name, until: date(until), resumes: date(resumes), first }),
        names,
        moment(today, "09:00"),
        [],
      );

    const resumesWith = lesson({ date: date("2026-11-02"), start: at("08:00") });

    expect(
      closed("2026-10-28", "Herbstferien", "2026-10-30", "2026-11-02", Option.some(resumesWith)),
    ).toEqual({
      heading: "Schöne Herbstferien!",
      card: {
        items: [],
        notice: {
          title: "Ferien bis Freitag, 30. Oktober",
          lines: ["Weiter geht's am Montag, 2. November.", "Um 08:00 mit Mathematik in A101."],
        },
      },
    });

    // On its last day the closure needs no end, and a lesson without a room is named alone.
    expect(
      closed(
        wednesday,
        "Buß- und Bettag",
        wednesday,
        "2026-11-19",
        Option.some(lesson({ roomIds: [] })),
      ),
    ).toEqual({
      heading: "Heute frei: Buß- und Bettag",
      card: {
        items: [],
        notice: { title: undefined, lines: ["Weiter geht's morgen.", "Um 09:50 mit Mathematik."] },
      },
    });

    // Not yet published: when, but not with what.
    expect(
      closed("2026-12-28", "Weihnachtsferien", "2027-01-08", "2027-01-11", Option.none()).card
        ?.notice,
    ).toEqual({
      title: "Ferien bis Freitag, 8. Januar",
      lines: ["Weiter geht's am Montag, 11. Januar."],
    });
  });

  it("hides the card without a timetable and names today in the hero", () => {
    expect(
      AgendaItem.agenda(Timetable.Shown.None(), names, moment(wednesday, "09:00"), []),
    ).toEqual({
      heading: "Mittwoch, 18. November",
      card: undefined,
    });
  });

  it("dates the Stand and says what an old one may miss, online and offline", () => {
    const today = date(wednesday);

    expect([
      AgendaItem.stand(moment(wednesday, "07:40"), today, false),
      AgendaItem.stand(moment("2026-11-17", "15:05"), today, true),
      AgendaItem.stand(moment("2026-11-13", "06:30"), today, true),
    ]).toEqual([
      { title: "Stand: heute, 07:40", hint: "Neuere Vertretungen fehlen vielleicht." },
      {
        title: "Stand: gestern, 15:05",
        hint: "Neuere Vertretungen siehst du, sobald du wieder online bist.",
      },
      {
        title: "Stand: Fr, 13.11., 06:30",
        hint: "Neuere Vertretungen siehst du, sobald du wieder online bist.",
      },
    ]);
  });
});
