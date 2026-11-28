/**
 * Turns a raw capture into a corpus that agents may read (m2-import-corpus.md, section 4). It reads
 * the capture twice: first to learn the people, their names and the school's frequent phrases,
 * then to write every read through the policy. Names and real ids stay in memory and leave only as
 * the dictionary the leak scan needs.
 */
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import type { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { IgsLilienthal } from "../profiles/IgsLilienthal.ts";
import type { Corpus } from "./Corpus.ts";
import { Policy } from "./Policy.ts";
import { Tokens } from "./Tokens.ts";

export * as Pseudonymizer from "./Pseudonymizer.ts";

export class PolicyFailed extends Schema.TaggedError<
  PolicyFailed,
  { readonly brand: unique symbol }
>()("Pseudonymizer.PolicyFailed", {
  problems: Schema.Array(
    Schema.Struct({
      read: Schema.String,
      path: Schema.String,
      problem: Schema.String,
      count: Schema.Int,
    }),
  ),
}) {
  override get message() {
    return `fields without a rule or of the wrong kind:${Policy.describe(this.problems)}`;
  }
}

export class NotRaw extends Schema.TaggedError<NotRaw, { readonly brand: unique symbol }>()(
  "Pseudonymizer.NotRaw",
  { policy: Schema.Int },
) {}

/** A free text is frequent when it appears on this many dates, with this many teachers. */
export const frequent = { dates: 5, teachers: 3, words: 5 } as const;

/** Who the leak scan looks for, by kind of name. The values never leave memory. */
export interface Dictionary {
  /** Lower-cased short names and words of longer names, matched as whole words in any case. */
  readonly names: ReadonlyMap<string, string>;
  /** Every real person id, which no pseudonymized id may equal. */
  readonly ids: ReadonlySet<number>;
}

const dateOrTime =
  /^(?:\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?|(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)$/u;

/** A string the grammar accepts without a vocabulary entry. */
export const isDateOrTime = (value: string) => dateOrTime.test(value);

/** A date of the calendar, such as `2026-11-04`, and not `2026-02-30`. */
const isCalendarDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);

  if (year === undefined || month === undefined || day === undefined) return false;

  const days = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (days[month - 1] ?? 0)
  );
};

/**
 * A room number such as `A101`, `NW 2`, `R1.04` or `Raum 101`: at most four letters, then digits.
 * A longer word may be a person's name, so such a room becomes a token.
 */
const roomNumber = /^\p{L}{0,4}[ .\-/]?\d{1,4}(?:[.\-/]?[\p{L}\d]{1,4})?$/u;

export const isRoomNumber = (value: string) => roomNumber.test(value);

/**
 * The words of a text, its letters composed first, so `ä` written as `a` and `¨` is one letter,
 * and with the marks no composed form holds kept inside the word.
 */
export const wordsOf = (value: string) =>
  value.normalize("NFC").match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];

/** The word as the dictionary keeps it. */
export const normalized = (word: string) => word.normalize("NFC").toLocaleLowerCase("de");

const people = { T: "teacher", S: "student", P: "person" } as const;

const field = (path: string) => path.slice(path.lastIndexOf(".") + 1);

const yearOf = (read: string) => {
  const year = /^(\d+)\//u.exec(read)?.[1];

  return year === undefined ? undefined : Number(year);
};

const textOf = (value: Policy.Json | undefined) => (Predicate.isString(value) ? value : undefined);

const shortNameOf = (resource: Policy.Json | undefined) => {
  const name = Policy.isObject(resource) ? textOf(resource.shortName) : undefined;

  return name === undefined ? [] : [name];
};

/** The date and the teachers of the entry or exam a free text belongs to. */
const evidence = (ancestors: ReadonlyArray<Policy.JsonObject>) => {
  let date: string | undefined;
  const teachers: Array<string> = [];

  for (const ancestor of ancestors) {
    const duration = ancestor.duration;

    // An entry's start can be a time of day alone, so only a full date counts; the day has one.
    const dated = [
      Policy.isObject(duration) ? textOf(duration.start) : undefined,
      textOf(ancestor.examStart),
      textOf(ancestor.date),
    ].find((each) => each !== undefined && isDateOrTime(each) && isCalendarDate(each.slice(0, 10)));

    date ??= dated?.slice(0, 10);

    for (const key of ["position1", "position2", "position3", "position4"]) {
      const positions = ancestor[key];

      if (!Array.isArray(positions)) continue;

      for (const position of positions) {
        if (!Policy.isObject(position)) continue;

        for (const side of [position.current, position.removed]) {
          if (Policy.isObject(side) && side.type === "TEACHER") teachers.push(...shortNameOf(side));
        }
      }
    }

    const listed = ancestor.teachers;

    if (Array.isArray(listed)) teachers.push(...listed.flatMap(shortNameOf));

    if (ancestor.resourceType === "TEACHER") teachers.push(...shortNameOf(ancestor.resource));
  }

  return { date, teachers };
};

export interface Pseudonymized {
  readonly manifest: Corpus.Manifest;
  readonly dictionary: Dictionary;
}

const kept = (value: Policy.Json | typeof Policy.dropped) => Result.succeed(value);

/** A value of the wrong kind, unless it is `null`, which WebUntis writes for anything absent. */
const unexpected = (value: Policy.Json, problem: string) =>
  value === null ? kept(null) : Result.fail(problem);

/**
 * Pseudonymizes the reads of a raw capture and hands each to `write`. Nothing is written when a
 * read holds a field without a rule; the failure lists every such field.
 */
export const run = Effect.fn("Pseudonymizer.run")(function* <E, R, E2, R2>(input: {
  readonly key: Uint8Array;
  readonly manifest: Corpus.Manifest;
  readonly reads: Stream.Stream<readonly [string, RecordedWebUntis.Read], E, R>;
  readonly write: (name: string, read: RecordedWebUntis.Read) => Effect.Effect<void, E2, R2>;
  /**
   * Whether the reads name the students, as a capture's do, so the dictionary knows every name.
   * The source store's name none, so for its exports any word could be a student's: free text
   * stays only as a stock phrase, and a code's or room's word only in capitals (`MA-E`, `NW 2`).
   */
  readonly students?: "named" | "unnamed";
}) {
  if (input.manifest.policy !== 0) return yield* new NotRaw({ policy: input.manifest.policy });

  const tokens = Tokens.make(input.key);
  const problems = Policy.tally();

  const names = new Map<string, string>();
  const ids = new Set<number>();
  const persons = { T: new Set<number>(), S: new Set<number>(), P: new Set<number>() };
  const teachers = new Map<number | undefined, Map<string, number>>();
  const texts = new Map<string, { dates: Set<string>; teachers: Set<string> }>();

  const learnWords = (value: string, category: string) => {
    for (const word of wordsOf(value)) {
      if (word.length >= 2 && !/^\d+$/u.test(word)) names.set(normalized(word), category);
    }
  };

  const learnTeacher = (year: number | undefined, shortName: string, id: number) => {
    for (const scope of [year, undefined]) {
      const known = teachers.get(scope) ?? new Map<string, number>();

      if (!known.has(normalized(shortName))) known.set(normalized(shortName), id);

      teachers.set(scope, known);
    }
  };

  const teacherOf = (year: number | undefined, shortName: string) =>
    teachers.get(year)?.get(normalized(shortName)) ??
    teachers.get(undefined)?.get(normalized(shortName));

  const survey = (read: string, body: Policy.Json, node: Policy.Node) => {
    const year = yearOf(read);

    return Policy.walk(node, body, {
      leaf: (leaf, value, { path, ancestors }) => {
        const [parent] = ancestors;

        if (leaf._tag === "PersonId" && Predicate.isNumber(value)) {
          ids.add(value);
          persons[leaf.kind].add(value);
        }

        if (leaf._tag === "PersonName" && Predicate.isString(value)) {
          // The store's placeholder for a name names nobody, and `student` is a word of its paths.
          const stored = Policy.placeholder(leaf.kind, leaf.by === "id" ? parent?.id : undefined);

          if (input.students !== "unnamed" || value !== stored) {
            learnWords(value, `${people[leaf.kind]} ${field(path)}`);
          }

          const id = parent?.id;

          if (leaf.kind === "T" && leaf.by === "id" && field(path) === "shortName") {
            if (Predicate.isNumber(id)) learnTeacher(year, value, id);
          }
        }

        if (leaf._tag === "Constant" && leaf.names === true && Predicate.isString(value)) {
          // The domain names the school, which the tenant's name shows anyway; the rest names a person.
          learnWords(value.split("@")[0] ?? "", `account ${field(path)}`);
        }

        if (leaf._tag === "Text" && Predicate.isString(value) && value.trim() !== "") {
          const seen = texts.get(value) ?? {
            dates: new Set<string>(),
            teachers: new Set<string>(),
          };

          const { date, teachers: who } = evidence(ancestors);

          if (date !== undefined) seen.dates.add(date);

          // Resolved once the directories are read, in this read's school year.
          for (const teacher of who) seen.teachers.add(`${year ?? ""}|${teacher}`);

          texts.set(value, seen);
        }

        return kept(value);
      },
    });
  };

  yield* Stream.runForEach(input.reads, ([name, read]) =>
    Effect.sync(() => {
      const rules = Policy.forRead(name);

      if (rules === undefined) {
        problems.add(name, [{ path: "", problem: "a read without rules" }]);

        return;
      }

      const person = rules.view === undefined ? undefined : Policy.personOfView(rules.view.type);

      if (person !== undefined && rules.view !== undefined) {
        ids.add(rules.view.resource);
        persons[person].add(rules.view.resource);
      }

      for (const version of read.versions) {
        problems.add(name, survey(name, version.body, rules.node).problems);
      }
    }),
  );

  // An unknown key is shown so the policy can learn it, unless it holds a name learned here.
  const unnamed = (path: string) =>
    path
      .split(".")
      .map((segment) =>
        wordsOf(segment).some((word) => names.has(normalized(word))) ? "<unknown>" : segment,
      )
      .join(".");

  const found = problems.list().map((problem) => ({ ...problem, path: unnamed(problem.path) }));

  if (found.length > 0) return yield* new PolicyFailed({ problems: found });

  // Registered in order of their ids, so a collision always resolves the same way.
  for (const kind of ["T", "S", "P"] as const) {
    for (const id of [...persons[kind]].toSorted((a, b) => a - b)) {
      tokens.id(kind, id);
      tokens.token(kind, `id:${id}`);
    }
  }

  /**
   * A phrase that names someone, holds a person's id anywhere, or holds contact details (an
   * address, a link, or as many digits as a phone number) is never kept, however frequent.
   */
  const named = (value: string) => {
    // NFKC turns digits of other forms, such as `５`, into ASCII ones.
    const plain = value.normalize("NFKC");

    return (
      wordsOf(value).some((word) => names.has(normalized(word))) ||
      (plain.match(/\d+/gu) ?? []).some((digits) => ids.has(Number(digits))) ||
      /@|:\/\/|www\./iu.test(plain) ||
      // Digits of other scripts, which NFKC keeps, could hide an id or a number.
      /(?![0-9])\p{Nd}/u.test(plain) ||
      (plain.match(/\d/gu) ?? []).length >= 6
    );
  };

  /**
   * Whether an unnamed export can read a code or a room at all: Latin letters, ASCII digits,
   * spaces and ASCII marks, as a school writes its codes. Any other character, such as a letter of
   * another script, a combining or circled letter, or a Roman numeral, could spell a name.
   */
  const unreadable = (value: string) =>
    input.students === "unnamed" && !/^[A-Za-zÀ-ÖØ-öø-ÿ0-9 !-/:-@[-`{-~]*$/u.test(value);

  /** A run of letters that could be a student's name the dictionary lacks: any but capitals. */
  const mayName = (run: string) => input.students === "unnamed" && !/^[\p{Lu}\p{M}]+$/u.test(run);

  const letterRuns = (value: string) => value.normalize("NFC").match(/\p{L}[\p{L}\p{M}]*/gu) ?? [];

  const stock = new Set(
    IgsLilienthal.profile.stockPhrases.map((phrase) => phrase.toLocaleLowerCase("de")),
  );

  const phrases = new Set(
    [...texts].flatMap(([value, seen]) =>
      stock.has(value.trim().toLocaleLowerCase("de")) ||
      (input.students !== "unnamed" &&
        seen.dates.size >= frequent.dates &&
        new Set(
          [...seen.teachers].map((seenAs) => {
            const [year = "", name = ""] = seenAs.split(/\|(.*)/su);

            return teacherOf(year === "" ? undefined : Number(year), name) ?? normalized(name);
          }),
        ).size >= frequent.teachers &&
        value.trim().split(/\s+/u).length <= frequent.words &&
        !named(value))
        ? [value]
        : [],
    ),
  );

  const vocabulary = new Map<string, number>();
  const keptPhrases = new Map<string, number>();

  const count = (counts: Map<string, number>, value: string) =>
    counts.set(value, (counts.get(value) ?? 0) + 1);

  const code = (year: number | undefined, raw: string) => {
    const value = raw.normalize("NFC");

    // Judged as WebUntis sent it: NFC turns some signs into letters, the Kelvin sign (U+212A) into `K`.
    if (unreadable(raw)) return tokens.token("X", value);

    return value
      .split(/([^\p{L}\p{M}\p{N}]+)/u)
      .map((segment, index) => {
        if (index % 2 !== 0) return segment;

        const teacher = teacherOf(year, segment);

        if (teacher !== undefined) return tokens.token("T", `id:${teacher}`);

        if (names.has(normalized(segment))) return tokens.token("X", normalized(segment));

        // A name glued to digits, as in `Kunz12`, is still a name.
        return segment.replace(/\p{L}[\p{L}\p{M}]*/gu, (run) =>
          names.has(normalized(run)) || mayName(run) ? tokens.token("X", normalized(run)) : run,
        );
      })
      .join("");
  };

  const pseudonymize = (read: string, body: Policy.Json, node: Policy.Node) => {
    const year = yearOf(read);

    return Policy.walk(node, body, {
      leaf: (leaf, value, { ancestors }) => {
        const [parent] = ancestors;

        switch (leaf._tag) {
          case "Keep": {
            if (Policy.isObject(value) || Array.isArray(value)) {
              return Result.fail("expected a plain value");
            }

            if (Predicate.isString(value) && value !== "" && !isDateOrTime(value)) {
              count(vocabulary, value);
            }

            return kept(value);
          }

          case "Drop":
            return kept(Policy.dropped);
          case "Constant":
            return kept(leaf.value);
          case "Text": {
            if (!Predicate.isString(value)) return unexpected(value, "expected text");

            if (value.trim() === "") return kept(value);

            if (!phrases.has(value)) {
              return kept(`${tokens.token("X", value)}-${value.length}`);
            }

            count(keptPhrases, value);

            return kept(value);
          }

          case "Room": {
            if (!Predicate.isString(value)) return unexpected(value, "expected a room name");

            if (
              value !== "" &&
              (!isRoomNumber(value) || unreadable(value) || letterRuns(value).some(mayName))
            ) {
              return kept(tokens.token("R", value));
            }

            if (value !== "") count(vocabulary, value);

            return kept(value);
          }

          case "Code": {
            if (!Predicate.isString(value)) return unexpected(value, "expected a code");

            const out = code(year, value);

            if (out !== "") count(vocabulary, out);

            return kept(out);
          }

          case "PersonId": {
            if (!Predicate.isNumber(value)) return unexpected(value, "expected an id");

            return kept(tokens.id(leaf.kind, value));
          }

          case "PersonName": {
            if (!Predicate.isString(value)) return unexpected(value, "expected a name");

            if (value === "") return kept(value);

            if (leaf.by === "id") {
              const id = parent?.id;

              return Predicate.isNumber(id)
                ? kept(tokens.token(leaf.kind, `id:${id}`))
                : Result.fail("a name without an id");
            }

            const shortName = parent?.shortName;

            if (!Predicate.isString(shortName)) return Result.fail("a name without a short name");

            const teacher = teacherOf(year, shortName);

            return kept(
              teacher === undefined
                ? tokens.token(leaf.kind, `name:${shortName}`)
                : tokens.token(leaf.kind, `id:${teacher}`),
            );
          }
        }
      },
    });
  };

  yield* Stream.runForEach(input.reads, ([name, read]) => {
    const rules = Policy.forRead(name);

    if (rules === undefined) return Effect.void;

    const versions = read.versions.map((version) => {
      const { value, problems: found } = pseudonymize(name, version.body, rules.node);

      problems.add(name, found);

      // A rule that drops or replaces a field the schema needs would cost the harness the read.
      if (rules.decodes(version.body) && !rules.decodes(value)) {
        problems.add(name, [{ path: "", problem: "no longer decodes with webuntis-api's schema" }]);
      }

      return { ...version, body: value };
    });

    const person = rules.view === undefined ? undefined : Policy.personOfView(rules.view.type);

    const out =
      person === undefined || rules.view === undefined
        ? name
        : Policy.entriesPath(rules.view, tokens.id(person, rules.view.resource));

    return input.write(out, { versions });
  });

  const left = problems.list();

  if (left.length > 0) return yield* new PolicyFailed({ problems: left });

  const sorted = (counts: ReadonlyMap<string, number>) =>
    [...counts]
      .map(([value, times]) => ({ value, count: times }))
      .toSorted((a, b) => a.value.localeCompare(b.value));

  return {
    manifest: {
      ...input.manifest,
      policy: Policy.version,
      kept: { vocabulary: sorted(vocabulary), phrases: sorted(keptPhrases) },
    },
    dictionary: { names, ids },
  } satisfies Pseudonymized;
});

/** Pseudonymizes a corpus held in memory, such as an invented school. */
export const corpus = Effect.fn("Pseudonymizer.corpus")(function* (
  key: Uint8Array,
  raw: Corpus.Corpus,
) {
  const reads = new Map<string, RecordedWebUntis.Read>();

  const result = yield* run({
    key,
    manifest: raw.manifest,
    reads: Stream.fromIterable(raw.reads),
    write: (name, read) => Effect.sync(() => void reads.set(name, read)),
  });

  return {
    corpus: { manifest: result.manifest, reads, cases: raw.cases } satisfies Corpus.Corpus,
    dictionary: result.dictionary,
  };
});
