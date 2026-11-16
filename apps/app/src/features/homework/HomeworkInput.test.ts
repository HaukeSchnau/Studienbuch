import { assert, describe, expect, it } from "@effect/vitest";
import { CivilTime, SchoolYear, type Term } from "@stu/core";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { HomeworkInput } from "./HomeworkInput.ts";

const date = Schema.decodeSync(CivilTime.PlainDate);

// Monday, 16 November 2026.
const today = date("2026-11-16");

const filled = {
  courseId: "course-ma",
  title: "S. 112, Nr. 4 bis 7",
  description: "",
  dueOn: date("2026-11-18"),
};

const context: HomeworkInput.Context = { today, offered: ["course-ma", "course-de"] };

const current: HomeworkInput.Current = {
  courseId: "course-ph",
  title: "Versuchsprotokoll",
  description: "Mit Skizze",
  dueOn: date("2026-11-09"),
};

const term = (id: string, start: string, end: string) => ({
  id,
  row: {
    schoolYearId: SchoolYear.Id.make("year-2026"),
    name: id,
    dates: { start: date(start), end: date(end) },
  } satisfies Term.Row,
});

describe("HomeworkInput.decode", () => {
  it("decodes a filled sheet, with a blank description as none", () => {
    const valid = HomeworkInput.decode(filled, context);

    assert.deepStrictEqual(
      Option.map(valid, (v) => [v.courseId, v.title, v.description, v.dueOn.day]),
      Option.some(["course-ma", "S. 112, Nr. 4 bis 7", undefined, 18]),
    );
  });

  it.each([
    ["no Fach", { ...filled, courseId: null }],
    ["a course not chosen this term", { ...filled, courseId: "course-ph" }],
    ["no title", { ...filled, title: "" }],
    ["a title of spaces", { ...filled, title: "   " }],
    ["a title over 200", { ...filled, title: "x".repeat(201) }],
    ["a description over 4,000", { ...filled, description: "x".repeat(4001) }],
    ["no due date", { ...filled, dueOn: null }],
    ["yesterday", { ...filled, dueOn: date("2026-11-15") }],
    ["a year and a day ahead", { ...filled, dueOn: date("2027-11-17") }],
  ])("keeps Speichern disabled for %s", (_, values) => {
    assert.isTrue(Option.isNone(HomeworkInput.decode(values, context)));
  });

  it.each([
    ["today", "2026-11-16"],
    ["a year ahead", "2027-11-16"],
  ])("takes %s as due date", (_, dueOn) => {
    assert.isTrue(Option.isSome(HomeworkInput.decode({ ...filled, dueOn: date(dueOn) }, context)));
  });

  it("keeps an edited homework's own past due date and dropped course valid, but no others", () => {
    const editing = { ...context, current };
    const unchanged = HomeworkInput.fromCurrent(current);

    assert.isTrue(Option.isSome(HomeworkInput.decode(unchanged, editing)));
    assert.isTrue(
      Option.isNone(HomeworkInput.decode({ ...unchanged, dueOn: date("2026-11-10") }, editing)),
    );
    assert.isTrue(
      Option.isNone(HomeworkInput.decode({ ...unchanged, courseId: "course-ku" }, editing)),
    );
  });
});

describe("HomeworkInput.changes", () => {
  it("sends only the fields an edit changed, and null to remove the description", () => {
    const touched = { title: "Versuchsprotokoll, sauber", description: " " };

    const edited = HomeworkInput.decode(HomeworkInput.values(current, touched), {
      ...context,
      current,
    });

    expect(Option.map(edited, (valid) => HomeworkInput.changes(valid, current, touched))).toEqual(
      Option.some({ title: "Versuchsprotokoll, sauber", description: null }),
    );
  });

  it("keeps a field the student didn't touch as another device changed it meanwhile", () => {
    // The student began editing the title while the due date was 9.11.; another device has since
    // moved it to 25.11.
    const live = { ...current, dueOn: date("2026-11-25") };
    const touched = { title: "Versuchsprotokoll, sauber" };

    expect(HomeworkInput.values(live, touched).dueOn).toEqual(live.dueOn);

    // Even values that still hold the old date send none: only touched fields go out.
    const stale = HomeworkInput.decode(
      { ...HomeworkInput.fromCurrent(current), ...touched },
      { ...context, current },
    );

    expect(Option.map(stale, (valid) => HomeworkInput.changes(valid, live, touched))).toEqual(
      Option.some({ title: "Versuchsprotokoll, sauber" }),
    );
  });
});

describe("HomeworkInput.offered", () => {
  const terms = [
    term("winter", "2026-08-01", "2027-01-31"),
    term("summer", "2027-02-01", "2027-07-31"),
  ];

  const enrollments = [
    { termId: "summer", courseIds: ["course-ch"] },
    { termId: "winter", courseIds: ["course-ma", "course-de"] },
  ];

  it("offers the courses chosen for today's term", () => {
    assert.deepStrictEqual(HomeworkInput.offered(enrollments, terms, today), [
      "course-ma",
      "course-de",
    ]);
  });

  it("offers none when today's term has no course choice, not another term's courses", () => {
    assert.deepStrictEqual(
      HomeworkInput.offered([{ termId: "summer", courseIds: ["course-ch"] }], terms, today),
      [],
    );
  });

  it("offers every chosen course when today falls in no term", () => {
    assert.deepStrictEqual(HomeworkInput.offered(enrollments, terms, date("2027-08-20")), [
      "course-ch",
      "course-ma",
      "course-de",
    ]);
  });
});
