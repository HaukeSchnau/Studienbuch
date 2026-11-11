/**
 * How a subject looks everywhere: one of the twelve subject colours (D49), its drawing where we
 * have one, and its letters where we don't. One subject, one look, in every term, on every device
 * and on the landing page. Known subjects have a fixed look, however a school spells them; any
 * other name hashes to a stable shared colour. The domain stays colour-free.
 */
import type { Subject } from "@stu/core";
import type { Tokens } from "@stu/ui/Tokens";

import type { SubjectDrawings } from "./SubjectDrawings.ts";

export * as SubjectLook from "./SubjectLook.ts";

export interface Look {
  readonly slot: Tokens.SubjectSlot;
  /** The subject's drawing. Without one, the marker shows `letters`. */
  readonly art?: SubjectDrawings.Name | undefined;
  /** Such as "MA", at most three letters. */
  readonly letters: string;
}

interface Known {
  readonly slot: Tokens.SubjectSlot;
  readonly art?: SubjectDrawings.Name;
  readonly names: ReadonlyArray<string>;
}

// Twelve colours for more than twenty subjects. The core subjects and the sciences each get their
// own; subjects a student usually chooses one of share one: the arts, the second languages, and the
// values subjects with politics.
const known: ReadonlyArray<Known> = [
  { slot: "blue", art: "ma", names: ["mathematik", "mathe", "ma", "m"] },
  { slot: "rust", art: "de", names: ["deutsch", "de", "d"] },
  { slot: "violet", art: "en", names: ["englisch", "en", "e"] },
  { slot: "red", art: "sp", names: ["sport", "sp"] },
  { slot: "green", art: "bi", names: ["biologie", "bio", "bi"] },
  { slot: "teal", art: "ch", names: ["chemie", "ch"] },
  { slot: "cyan", art: "ph", names: ["physik", "ph"] },
  { slot: "amber", art: "ge", names: ["geschichte", "gesch", "ge", "g"] },
  {
    slot: "slate",
    names: [
      "politik",
      "politikwirtschaft",
      "powi",
      "pw",
      "sozialkunde",
      "gemeinschaftskunde",
      "wirtschaft",
      "werteundnormen",
      "wn",
      "wun",
      "ethik",
      "philosophie",
      "phil",
    ],
  },
  { slot: "slate", art: "re", names: ["religion", "re", "rel"] },
  {
    slot: "olive",
    names: ["erdkunde", "ek", "geographie", "geo", "seminarfach", "seminar", "sf"],
  },
  { slot: "magenta", art: "ku", names: ["kunst", "ku"] },
  { slot: "magenta", art: "mu", names: ["musik", "mu"] },
  { slot: "magenta", names: ["darstellendesspiel", "ds"] },
  { slot: "indigo", art: "fr", names: ["franzoesisch", "fr", "f"] },
  { slot: "indigo", art: "la", names: ["latein", "la", "l"] },
  { slot: "indigo", art: "if", names: ["informatik", "if"] },
  { slot: "indigo", names: ["spanisch", "spa", "sn"] },
];

const byName: ReadonlyMap<string, Known> = new Map(
  known.flatMap((subject) => subject.names.map((name) => [name, subject] as const)),
);

// The colours several subjects share. An unknown subject hashes onto one of them, so it never takes
// the colour of a subject that has its own, such as Mathematik or Geschichte.
const shared: ReadonlyArray<Tokens.SubjectSlot> = ["olive", "indigo", "magenta", "slate"];

/** Lower case, umlauts spelled out, letters only: "Politik-Wirtschaft" becomes "politikwirtschaft". */
const normalize = (name: string) =>
  name
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replaceAll(/[^a-z]/gu, "");

// FNV-1a, so the same name gets the same colour on every platform and in every release.
const hashed = (name: string): Tokens.SubjectSlot => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < name.length; index++) {
    hash = Math.imul(hash ^ name.charCodeAt(index), 0x01000193);
  }

  return shared[(hash >>> 0) % shared.length] ?? "slate";
};

// "Evangelische Religion", "Religion (kath.)": any religion is a values subject.
const find = (name: string) =>
  byName.get(name) ?? (name.includes("religion") ? byName.get("religion") : undefined);

const look = (found: Known | undefined, name: string, letters: string): Look => ({
  slot: found?.slot ?? hashed(name),
  art: found?.art,
  letters: letters.slice(0, 3),
});

/** The look of a subject, by its name or else its short name. */
export const ofSubject = (subject: Pick<Subject.Row, "name" | "shortName">): Look => {
  const name = normalize(subject.name);

  return look(
    find(name) ?? byName.get(normalize(subject.shortName)),
    name,
    subject.shortName === "" ? subject.name : subject.shortName,
  );
};

/**
 * The look of a course whose subject the school didn't name, by the letters its name starts with,
 * as "MA" in "MA-E1". Courses of one subject then share a look, which legacy's hash of the whole
 * course name didn't do.
 */
export const ofCourse = (courseName: string): Look => {
  const letters = /^[A-Za-zÄÖÜäöüß]+/u.exec(courseName.trim())?.[0] ?? courseName;
  const prefix = normalize(letters);

  return look(find(prefix), prefix, letters);
};
