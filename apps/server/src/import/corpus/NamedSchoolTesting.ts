/**
 * The invented school as a raw capture would hold it: an invented name in every personal field,
 * in free text, in an email address, an image URL, a room and a course code. Every name is listed
 * in `names`, so a test can look for each in what the pseudonymizer writes.
 */
import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import type { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { TinySchool } from "../evaluation/TinySchool.ts";
import { Corpus } from "./Corpus.ts";
import { Policy } from "./Policy.ts";

export * as NamedSchoolTesting from "./NamedSchoolTesting.ts";

const teachers = [
  ["LA", "Lehrkraft A", "QAM", "Quendolin", "Amselreuter"],
  ["LB", "Lehrkraft B", "RBR", "Rodewald", "Brombeerhag"],
  ["LC", "Lehrkraft C", "SCO", "Sibylla", "Coldewey"],
  ["LD", "Lehrkraft D", "TDO", "Thankmar", "Dornhecke"],
  ["LE", "Lehrkraft E", "UEI", "Ulrike", "Eibenkamp"],
  ["LF", "Lehrkraft F", "VFA", "Volkhard", "Farnwedel"],
] as const;

const students = [
  ["Wiebke", "Gänseblum"],
  ["Xaverius", "Haselbusch"],
  ["Yvonne", "Igelstedt"],
  ["Zacharias", "Jasminhof"],
  ["Adelheid", "Kranichfeld"],
  ["Bertram", "Lerchenau"],
  ["Clothilde", "Mohnblatt"],
  ["Dietlinde", "Nesselrode"],
] as const;

const account = ["Ottokar", "Pfauenstein"] as const;

/** Every invented name and name part, as the leak tests look for them. */
export const names: ReadonlyArray<string> = [
  ...teachers.flatMap(([, , short, first, last]) => [short, first, last]),
  ...students.flatMap(([first, last]) => [`${first.slice(0, 3)}${last.slice(0, 3)}`, first, last]),
  ...account,
];

const renamed = new Map<string, string>([
  ...teachers.flatMap(([short, long, newShort, first, last]): Array<[string, string]> => [
    [short, newShort],
    [long, `${last}, ${first}`],
  ]),
  ...students.flatMap(([first, last], index): Array<[string, string]> => [
    [`S${index + 1}`, `${first.slice(0, 3)}${last.slice(0, 3)}`],
    [`Schüler ${index + 1}`, `${last}, ${first}`],
  ]),
  ["Konto A", `${account[1]}, ${account[0]}`],
  // A course named after its teacher, and a room named after a person.
  ["INF", "INF-vfa"],
  ["R105", "Raum Coldewey"],
]);

const isObject = Policy.isObject;

/** Free text by an entry's first id: names, a frequent phrase with a name, and one without. */
const texts = (id: number): Policy.JsonObject => ({
  // Frequent, but naming teacher A by a lower-cased short name, or holding student 1's real id.
  notesAll:
    id % 3 === 0
      ? `${teachers[0][3]} ${teachers[0][4]} ist krank`
      : id % 3 === 1
        ? `Material bei ${teachers[0][2].toLowerCase()} holen`
        : "Abgabe an ID501",
  lessonText: id % 4 === 2 ? "Material mitbringen" : `${students[0][0]} holt den Beamer`,
  // The surname with its umlaut as a letter and a separate mark, as some systems write it.
  lessonInfo:
    id % 4 === 0 ? `Grüße an ${teachers[2][3]}` : `Grüße an ${students[0][1]}`.normalize("NFD"),
  texts: [
    { type: "INFO", text: `Rücksprache mit ${teachers[3][3]} ${teachers[3][4]}` },
    { type: "INFO", text: "Rückruf unter 0151 2345678" },
  ],
});

const imageOf = (name: string) => `https://example.invalid/images/${name}.png`;

/** The JSON with every name replaced, and personal fields filled that the invented school leaves empty. */
const render = (value: Policy.Json, key = ""): Policy.Json => {
  if (Predicate.isString(value)) return renamed.get(value) ?? value;

  if (Array.isArray(value)) return value.map((item) => render(item, key));

  if (!isObject(value)) return value;

  const out: Record<string, Policy.Json> = {};

  for (const [field, inner] of Object.entries(value)) out[field] = render(inner, field);

  const firstId = Array.isArray(value.ids) ? value.ids[0] : undefined;

  if (Predicate.isNumber(firstId) && "duration" in value) Object.assign(out, texts(firstId));

  if ((key === "teachers" || key === "students") && "imageUrl" in value) {
    const person = out.teacher ?? out.student ?? out;

    out.imageUrl = imageOf(
      isObject(person) && Predicate.isString(person.shortName) ? person.shortName : "x",
    );
  }

  if (key === "students" && "gender" in value) {
    Object.assign(out, { gender: "W", klasse: "12", disadvantageCompensation: true });
  }

  if (key === "user") {
    Object.assign(out, {
      email: `${account[0].toLowerCase()}.${account[1].toLowerCase()}@example.invalid`,
      person: {
        displayName: `${account[1]}, ${account[0]}`,
        id: 77,
        imageUrl: imageOf(account[1]),
      },
      lastLogin: "2026-11-01T10:00",
    });
  }

  if ("examText" in value) {
    Object.assign(out, {
      examText: `Nachschreiber ${students[1][0]} ${students[1][1]}`,
      invigilators: [
        {
          start: "2026-11-05T11:30",
          end: "2026-11-05T12:50",
          teachers: [
            { id: 205, shortName: "UEI", longName: "Eibenkamp", displayName: "Eibenkamp, Ulrike" },
          ],
        },
      ],
    });
  }

  return out;
};

const renderRead = (read: RecordedWebUntis.Read): RecordedWebUntis.Read => ({
  versions: read.versions.map((version) => ({ ...version, body: render(version.body) })),
});

export const corpus: Corpus.Corpus = {
  manifest: TinySchool.corpus.manifest,
  reads: new Map([...TinySchool.corpus.reads].map(([path, read]) => [path, renderRead(read)])),
  cases: TinySchool.corpus.cases,
};

/** Every place below `value` where `name` appears, in any case, as a path. */
export const appearances = (value: Policy.Json, name: string, path = ""): ReadonlyArray<string> => {
  if (Predicate.isString(value)) {
    const lower = (text: string) => text.normalize("NFC").toLocaleLowerCase("de");

    return lower(value).includes(lower(name)) ? [path] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item: Policy.Json) => appearances(item, name, `${path}[]`));
  }

  if (!isObject(value)) return [];

  return Object.entries(value).flatMap(([key, inner]) => [
    ...appearances(key, name, `${path}.${key}`),
    ...appearances(inner, name, `${path}.${key}`),
  ]);
};

const encodeManifest = Schema.encodeEffect(Schema.toCodecJson(Corpus.Manifest));

/** The corpus's manifest, read paths and bodies as one JSON value to search. */
export const everything = Effect.fn("NamedSchoolTesting.everything")(function* (
  corpus: Corpus.Corpus,
) {
  return {
    manifest: yield* encodeManifest(corpus.manifest),
    reads: [...corpus.reads].map(([path, read]) => ({
      path,
      bodies: read.versions.map(({ body }) => body),
    })),
  };
});

export type Mutable = { [key: string]: Policy.Json };

const isMutable = (value: Policy.Json | undefined): value is Mutable => Policy.isObject(value);

const isList = (value: Policy.Json | undefined): value is ReadonlyArray<Policy.Json> =>
  Array.isArray(value);

/** `value` as an object a test may change, or a failed test. */
export const object = (value: Policy.Json | undefined): Mutable =>
  isMutable(value) ? value : assert.fail("expected an object");

export const list = (value: Policy.Json | undefined): ReadonlyArray<Policy.Json> =>
  isList(value) ? value : assert.fail("expected a list");

/** The first lesson of the first day of an entries body that has one. */
export const firstEntry = (body: Mutable): Mutable =>
  object(
    list(body.days)
      .map((day) => list(object(day).gridEntries))
      .find((entries) => entries.length > 0)?.[0],
  );

/** `corpus` with a copy of one read's first version changed by `plant`. */
export const planted = (
  corpus: Corpus.Corpus,
  path: string,
  plant: (body: Mutable) => void,
): Corpus.Corpus => {
  const [first, ...rest] = corpus.reads.get(path)?.versions ?? [];

  assert.isDefined(first);

  const body = object(structuredClone(first.body));

  plant(body);

  const changed: RecordedWebUntis.Read = { versions: [{ ...first, body }, ...rest] };

  return { ...corpus, reads: new Map([...corpus.reads, [path, changed]]) };
};
