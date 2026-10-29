/**
 * Which of the twelve subject colours a subject gets (D49): one subject, one colour, in every term,
 * on every device and on the landing page. Known subjects have a fixed slot, however a school spells
 * them; any other name hashes to a stable slot. The domain stays colour-free.
 */
import type { Subject } from "@stu/core";
import type { Tokens } from "@stu/ui/Tokens";

export * as SubjectColor from "./SubjectColor.ts";

// Twelve slots for more than twenty subjects. The core subjects and the sciences each get their own;
// subjects a student usually chooses one of share a slot: the arts, the second languages, and the
// values subjects with politics.
const known: ReadonlyArray<readonly [Tokens.SubjectSlot, ReadonlyArray<string>]> = [
  ["blue", ["mathematik", "mathe", "ma", "m"]],
  ["rust", ["deutsch", "de", "d"]],
  ["violet", ["englisch", "en", "e"]],
  ["red", ["sport", "sp"]],
  ["green", ["biologie", "bio", "bi"]],
  ["teal", ["chemie", "ch"]],
  ["cyan", ["physik", "ph"]],
  ["amber", ["geschichte", "gesch", "ge", "g"]],
  [
    "slate",
    [
      "politik",
      "politikwirtschaft",
      "powi",
      "pw",
      "sozialkunde",
      "gemeinschaftskunde",
      "wirtschaft",
      "religion",
      "re",
      "rel",
      "werteundnormen",
      "wn",
      "wun",
      "philosophie",
      "phil",
    ],
  ],
  ["olive", ["erdkunde", "ek", "geographie", "geo", "seminarfach", "seminar", "sf"]],
  ["magenta", ["kunst", "ku", "musik", "mu", "darstellendesspiel", "ds"]],
  [
    "indigo",
    ["franzoesisch", "fr", "f", "spanisch", "spa", "sn", "latein", "la", "l", "informatik", "if"],
  ],
];

const slots: ReadonlyMap<string, Tokens.SubjectSlot> = new Map(
  known.flatMap(([slot, names]) => names.map((name) => [name, slot] as const)),
);

// The order of Tokens.subject, for the hash.
const palette: ReadonlyArray<Tokens.SubjectSlot> = [
  "red",
  "rust",
  "amber",
  "olive",
  "green",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "violet",
  "magenta",
  "slate",
];

/** Lower case, umlauts spelled out, letters only: "Politik-Wirtschaft" becomes "politikwirtschaft". */
const normalize = (name: string) =>
  name
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replaceAll(/[^a-z]/gu, "");

// FNV-1a, so the same name gets the same slot on every platform and in every release.
const hashed = (name: string): Tokens.SubjectSlot => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < name.length; index++) {
    hash = Math.imul(hash ^ name.charCodeAt(index), 0x01000193);
  }

  return palette[(hash >>> 0) % palette.length] ?? "slate";
};

/** The slot of a subject, by its name or else its short name. */
export const ofSubject = (subject: Pick<Subject.Row, "name" | "shortName">): Tokens.SubjectSlot => {
  const name = normalize(subject.name);

  return slots.get(name) ?? slots.get(normalize(subject.shortName)) ?? hashed(name);
};

/**
 * The slot of a course whose subject the school didn't name, by the letters its name starts with, as
 * "MA" in "MA-E1". Courses of one subject then share a colour, which legacy's hash of the whole
 * course name didn't do.
 */
export const ofCourse = (courseName: string): Tokens.SubjectSlot => {
  const prefix = normalize(/^[A-Za-zÄÖÜäöüß]+/u.exec(courseName.trim())?.[0] ?? courseName);

  return slots.get(prefix) ?? hashed(prefix);
};
