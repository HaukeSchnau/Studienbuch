/**
 * Every id the import gives a row (m2-import-path.md, section 4, "Rows"). Rows that stand for a
 * WebUntis record get a UUIDv5 of `<school>/<kind>/<key>`, so a record keeps its id in every run,
 * after a restore, and whichever order the reads came in. Rows of the school's own calendar get
 * readable ids, such as `2026-1` for a term.
 */
// UUIDv5 needs SHA-1 synchronously, and the import is pure; Effect's Crypto digests in an Effect.
// oxlint-disable-next-line effecttsgo/node-builtin-import -- see above
import * as NodeCrypto from "node:crypto";
import {
  CivilTime,
  Closure,
  Course,
  type School,
  SchoolClass,
  SchoolYear,
  Subject,
  Teacher,
  Room,
  Term,
} from "@stu/core";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

export * as ImportIds from "./ImportIds.ts";

/** The import's own namespace. Changing it changes every id, so it never changes. */
const namespace = "7d19011e-cb90-4a14-a4ed-f160788e15ab";

/** The UUIDv5 of `name` in the namespace `space` (RFC 9562, section 5.5). */
export const uuid5 = (space: string, name: string): string => {
  const digest = NodeCrypto.createHash("sha1")
    .update(Buffer.from(space.replaceAll("-", ""), "hex"))
    .update(name, "utf8")
    .digest();

  const versioned = (digest[6] ?? 0) % 16;
  const variant = (digest[8] ?? 0) % 64;

  digest[6] = 0x50 + versioned;
  digest[8] = 0x80 + variant;

  const hex = digest.subarray(0, 16).toString("hex");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

const keyed = (school: School.Id, kind: string, key: string | number) =>
  uuid5(namespace, `${school}/${kind}/${key}`);

/** A WebUntis subject, by its WebUntis id. */
export const subject = (school: School.Id, webUntisId: number) =>
  Subject.Id.make(keyed(school, "subject", webUntisId));

export const teacher = (school: School.Id, webUntisId: number) =>
  Teacher.Id.make(keyed(school, "teacher", webUntisId));

export const room = (school: School.Id, webUntisId: number) =>
  Room.Id.make(keyed(school, "room", webUntisId));

/** A WebUntis holiday, by its WebUntis id. */
export const closure = (school: School.Id, webUntisId: number) =>
  Closure.Id.make(keyed(school, "closure", webUntisId));

/** A course, by the key the import identifies it with, which `previous` keeps. */
export const course = (school: School.Id, key: string) =>
  Course.Id.make(keyed(school, "course", key));

/**
 * A lesson, by its course and its slot. A re-planned timetable keeps a slot's id even when WebUntis
 * renumbers its entries, so the lesson is updated rather than replaced.
 */
export const lesson = (school: School.Id, courseId: Course.Id, date: string, start: number) =>
  keyed(school, "lesson", `${courseId}/${date}/${start}`);

/** A school year by the calendar year it starts in, such as `2026` for 2026/27. */
export const schoolYear = (start: CivilTime.PlainDate) => SchoolYear.around(start).id;

/** A half of a school year, such as `2026-1`, as `Schools.simple` names them. */
export const term = (year: SchoolYear.Id, half: SchoolYear.Half["number"]) =>
  Term.Id.make(`${year}-${half}`);

/** A class of one school year, such as `2026-11.2`. */
export const schoolClass = (year: SchoolYear.Id, name: string) =>
  SchoolClass.Id.make(`${year}-${name}`);

const isIsoWeek = Schema.is(CivilTime.IsoWeek);

/** A week label's id, the ISO week such as `2026-W47`, when `week` is one its year has. */
export const weekLabel = (week: string): Option.Option<string> =>
  isIsoWeek(week) ? Option.some(week) : Option.none();
