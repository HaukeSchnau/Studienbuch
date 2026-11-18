import { assert, describe, it } from "@effect/vitest";
import { School } from "@stu/core";
import * as Option from "effect/Option";
import { ImportIds } from "./ImportIds.ts";

describe("ImportIds", () => {
  // RFC 9562, appendix A.4: the name "www.example.com" in the DNS namespace.
  it("mints the standard's UUIDv5", () => {
    assert.strictEqual(
      ImportIds.uuid5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "www.example.com"),
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
  });

  it("gives one WebUntis record the same id in every run, and each kind and school its own", () => {
    const school = School.Id.make("igs-lilienthal");

    const ids = [
      ImportIds.teacher(school, 201),
      ImportIds.teacher(school, 201),
      ImportIds.room(school, 201),
      ImportIds.teacher(School.Id.make("tiny-school"), 201),
    ];

    assert.deepStrictEqual(new Set(ids).size, 3);
    assert.strictEqual(ids[0], ids[1]);
  });

  it.each([
    { week: "2026-W47", id: Option.some("2026-W47") },
    // 2026 has 53 ISO weeks and 2027 has 52.
    { week: "2026-W53", id: Option.some("2026-W53") },
    { week: "2027-W53", id: Option.none() },
    { week: "2026-W00", id: Option.none() },
    { week: "2026-W7", id: Option.none() },
    { week: "2026-w47", id: Option.none() },
    { week: "２０２６-W47", id: Option.none() },
    { week: "2026-W47 ", id: Option.none() },
  ])("takes $week as a week label's id: $id", ({ week, id }) => {
    assert.deepStrictEqual(ImportIds.weekLabel(week), id);
  });
});
