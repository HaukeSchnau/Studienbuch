import { assert, describe, expect, it } from "@effect/vitest";
import { CivilTime } from "@stu/core";
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

describe("HomeworkInput.prefilled", () => {
  const opened = (params: HomeworkInput.Params, touched: HomeworkInput.Draft = {}) =>
    HomeworkInput.values(undefined, touched, HomeworkInput.prefilled(params, context));

  it("opens the add sheet with the lesson's course and its next lesson's date, ready to save once titled", () => {
    const values = opened({ courseId: "course-ma", dueOn: "2026-11-18" });

    expect(values).toEqual({ ...filled, title: "" });
    assert.isTrue(Option.isSome(HomeworkInput.decode({ ...values, title: "S. 112" }, context)));
  });

  it("lets what the student picked win over the params", () => {
    expect(
      opened({ courseId: "course-ma", dueOn: "2026-11-18" }, { courseId: "course-de" }).courseId,
    ).toBe("course-de");
  });

  it.each([
    ["a course not chosen this term", { courseId: "course-ph" }, { courseId: null, dueOn: null }],
    ["a date that isn't one", { dueOn: "2026-13-40" }, { courseId: null, dueOn: null }],
    ["a date already past", { dueOn: "2026-11-15" }, { courseId: null, dueOn: null }],
    [
      "one param twice",
      { courseId: ["course-ma", "course-de"], dueOn: "2026-11-18" },
      { courseId: null, dueOn: date("2026-11-18") },
    ],
  ])("leaves unpicked %s", (_, params, picked) => {
    expect(HomeworkInput.prefilled(params, context)).toEqual(picked);
  });

  it("keeps a lesson's draft apart from the plain add sheet's and from each edit's", () => {
    expect([
      HomeworkInput.draftKey(undefined, {}),
      HomeworkInput.draftKey(undefined, { courseId: "course-ma", dueOn: "2026-11-18" }),
      HomeworkInput.draftKey("8f6a1c2e-4b1d-4c3e-9a7b-2d5e6f708192", { courseId: "course-ma" }),
    ]).toEqual(["new", "new-course-ma", "8f6a1c2e-4b1d-4c3e-9a7b-2d5e6f708192"]);
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

describe("HomeworkInput.unchangedSince", () => {
  const submitted = { title: "Versuchsprotokoll", dueOn: date("2026-11-20") };

  it("lets the draft go when it still holds what was saved, the same date read again included", () => {
    assert.isTrue(
      HomeworkInput.unchangedSince(submitted, {
        title: "Versuchsprotokoll",
        dueOn: date("2026-11-20"),
      }),
    );
  });

  it.each([
    ["typed on after the press", { ...submitted, title: "Versuchsprotokoll, mit Skizze" }],
    ["touched another field after the press", { ...submitted, description: "Skizze" }],
    ["picked another date", { ...submitted, dueOn: date("2026-11-21") }],
  ])("keeps the draft when the student %s", (_, now) => {
    assert.isFalse(HomeworkInput.unchangedSince(submitted, now));
  });
});
