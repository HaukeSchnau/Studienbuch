/**
 * How a subject shows: one of the twelve colours (D49), its legacy art, letters where it has none,
 * and its blob. One subject, one mark, on every device and however a school spells it; an unknown
 * name hashes to a shared colour. The domain stays free of all of it.
 */
import type { Subject } from "@stu/core";
import type { SubjectArt } from "@stu/ui/SubjectArt";
import type { Tokens } from "@stu/ui/Tokens";

export * as SubjectMark from "./SubjectMark.ts";

export interface Mark {
  readonly slot: Tokens.SubjectSlot;
  readonly art: SubjectArt.Name | undefined;
  /** Up to three letters, such as "PW", for a subject without art. */
  readonly letters: string;
  /** The same number for the same subject, so its blob looks the same on every screen. */
  readonly seed: number;
}

// Twelve slots for more than twenty subjects. The core subjects and the sciences each get their own;
// subjects a student usually chooses one of share a slot: the arts, the second languages, and the
// values subjects with politics. The art is the legacy Flutter app's for the same subjects.
const known: ReadonlyArray<{
  readonly slot: Tokens.SubjectSlot;
  readonly art?: SubjectArt.Name;
  readonly names: ReadonlyArray<string>;
}> = [
  { slot: "blue", art: "math", names: ["mathematik", "mathe", "ma", "m"] },
  { slot: "rust", art: "german", names: ["deutsch", "de", "d"] },
  { slot: "violet", art: "english", names: ["englisch", "en", "e"] },
  { slot: "red", art: "sport", names: ["sport", "sp", "sporttheorie"] },
  { slot: "green", art: "biology", names: ["biologie", "bio", "bi"] },
  { slot: "teal", art: "chemistry", names: ["chemie", "ch"] },
  { slot: "cyan", art: "physics", names: ["physik", "ph"] },
  { slot: "amber", art: "history", names: ["geschichte", "gesch", "ge", "g"] },
  {
    slot: "slate",
    art: "politics",
    names: [
      "politik",
      "politikwirtschaft",
      "powi",
      "pw",
      "sozialkunde",
      "gemeinschaftskunde",
      "wirtschaft",
    ],
  },
  { slot: "slate", art: "religion", names: ["religion", "re", "rel"] },
  {
    slot: "slate",
    art: "ethics",
    names: ["werteundnormen", "wn", "wun", "ethik", "philosophie", "phil"],
  },
  { slot: "olive", names: ["erdkunde", "ek", "geographie", "geo"] },
  { slot: "olive", art: "seminar", names: ["seminarfach", "seminar", "sf"] },
  { slot: "magenta", art: "art", names: ["kunst", "ku"] },
  { slot: "magenta", art: "music", names: ["musik", "mu"] },
  { slot: "magenta", art: "drama", names: ["darstellendesspiel", "ds"] },
  { slot: "indigo", art: "french", names: ["franzoesisch", "fr", "f"] },
  { slot: "indigo", art: "spanish", names: ["spanisch", "spa", "sn"] },
  { slot: "indigo", art: "latin", names: ["latein", "la", "l"] },
  { slot: "indigo", art: "computing", names: ["informatik", "if"] },
];

const byNormalized = new Map(
  known.flatMap((subject) => subject.names.map((name) => [name, subject] as const)),
);

const religion = byNormalized.get("religion");

// The slots several subjects share. An unknown subject hashes onto one of them, so it never takes
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

// FNV-1a, so the same name gets the same mark on every platform and in every release.
const hash = (name: string) => {
  let value = 0x811c9dc5;

  for (let index = 0; index < name.length; index++) {
    value = Math.imul(value ^ name.charCodeAt(index), 0x01000193);
  }

  return value >>> 0;
};

// "Evangelische Religion", "Religion (kath.)": any religion is a values subject.
const find = (name: string) =>
  byNormalized.get(name) ?? (name.includes("religion") ? religion : undefined);

const letters = (text: string) =>
  text
    .replaceAll(/[^A-Za-zÄÖÜäöüß]/gu, "")
    .slice(0, 3)
    .toUpperCase();

const make = (normalized: string, fallback: string | undefined, shown: string): Mark => {
  const subject = find(normalized) ?? (fallback === undefined ? undefined : find(fallback));
  const seed = hash(normalized);

  return {
    slot: subject?.slot ?? shared[seed % shared.length] ?? "slate",
    art: subject?.art,
    letters: letters(shown),
    seed,
  };
};

/** The mark of a subject, by its name or else its short name. */
export const ofSubject = (subject: Pick<Subject.Row, "name" | "shortName">): Mark =>
  make(
    normalize(subject.name),
    normalize(subject.shortName),
    subject.shortName === "" ? subject.name : subject.shortName,
  );

/**
 * The mark of a course whose subject the school didn't name, by the letters its name starts with,
 * as "MA" in "MA-E1". Courses of one subject then share a mark, which legacy's hash of the whole
 * course name didn't do.
 */
export const ofCourse = (courseName: string): Mark =>
  make(
    normalize(/^[A-Za-zÄÖÜäöüß]+/u.exec(courseName.trim())?.[0] ?? courseName),
    undefined,
    courseName,
  );
