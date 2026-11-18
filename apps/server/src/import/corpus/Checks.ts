/**
 * The leak checks of a pseudonymized corpus (m2-import-corpus.md, section 4). The dictionary scan
 * runs during a capture, with the names the pseudonymizer learned in memory. The grammar and
 * layout checks need no real data, so every fetch runs them again. All report where and what
 * kind, never a value.
 */
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import type { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { Corpus } from "./Corpus.ts";
import { Policy } from "./Policy.ts";
import { Pseudonymizer } from "./Pseudonymizer.ts";
import { Tokens } from "./Tokens.ts";

export * as Checks from "./Checks.ts";

const Found = Schema.Array(
  Schema.Struct({
    read: Schema.String,
    path: Schema.String,
    problem: Schema.String,
    count: Schema.Int,
  }),
);

export class LeakFound extends Schema.TaggedError<LeakFound, { readonly brand: unique symbol }>()(
  "Checks.LeakFound",
  { hits: Found },
) {
  override get message() {
    return `names in the pseudonymized corpus:${Policy.describe(this.hits)}`;
  }
}

export class GrammarFailed extends Schema.TaggedError<
  GrammarFailed,
  { readonly brand: unique symbol }
>()("Checks.GrammarFailed", { problems: Found }) {
  override get message() {
    return `what the corpus may not hold:${Policy.describe(this.problems)}`;
  }
}

const encodeManifest = Schema.encodeEffect(Schema.toCodecJson(Corpus.Manifest));
const encodeCases = Schema.encodeEffect(Schema.toCodecJson(Corpus.Cases));

type Reads<E, R> = Stream.Stream<readonly [string, RecordedWebUntis.Read], E, R>;

/** Every string and key below `value`, with its path. */
const strings = function* (
  value: Policy.Json,
  path = "",
): Generator<{ readonly path: string; readonly value: string }> {
  if (Predicate.isString(value)) {
    yield { path, value };

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) yield* strings(item, `${path}[]`);

    return;
  }

  if (!Policy.isObject(value)) return;

  for (const [key, inner] of Object.entries(value)) {
    const at = path === "" ? key : `${path}.${key}`;

    yield { path: at, value: key };
    yield* strings(inner, at);
  }
};

/** The kind of name a string contains, if any. */
const nameIn = (dictionary: Pseudonymizer.Dictionary, value: string) => {
  for (const word of Pseudonymizer.wordsOf(value)) {
    const hit = dictionary.names.get(Pseudonymizer.normalized(word));

    if (hit !== undefined) return hit;
  }

  return undefined;
};

/**
 * Fails when any string of the corpus, its manifest, labelled cases and read paths included,
 * contains a name of the dictionary as a whole word in any case, or when a real person id could
 * pass for a pseudonymized one.
 */
export const scan = Effect.fn("Checks.scan")(function* <E, R>(input: {
  readonly dictionary: Pseudonymizer.Dictionary;
  readonly manifest: Corpus.Manifest;
  readonly cases: Corpus.Cases;
  readonly reads: Reads<E, R>;
}) {
  const hits = Policy.tally();

  const look = (read: string, value: Policy.Json) =>
    hits.add(
      read,
      [...strings(value)].flatMap(({ path, value: each }) => {
        const kind = nameIn(input.dictionary, each);

        return kind === undefined ? [] : [{ path, problem: `a ${kind}` }];
      }),
    );

  // A manifest and cases that decoded encode again; a failure would be a defect.
  look("manifest", yield* Effect.orDie(encodeManifest(input.manifest)));
  look("cases", yield* Effect.orDie(encodeCases(input.cases)));

  for (const id of input.dictionary.ids) {
    if (Tokens.isId(id)) {
      hits.add("ids", [{ path: "", problem: "a real id in the pseudonym range" }]);
    }
  }

  yield* Stream.runForEach(input.reads, ([name, read]) =>
    Effect.sync(() => {
      look(name, name);

      for (const version of read.versions) look(name, version.body);
    }),
  );

  const found = hits.list();

  if (found.length > 0) return yield* new LeakFound({ hits: found });
});

/** A corpus id or a case id: lower-case words joined by hyphens, so neither can name a path. */
const identifier = /^[a-z0-9][a-z0-9-]{0,63}$/u;

/** What the manifest and the labelled cases may hold besides the kept words. */
const headProblems = (manifest: Corpus.Manifest, cases: Corpus.Cases) => [
  ...(identifier.test(manifest.id)
    ? []
    : [{ path: "id", problem: "an id that isn't a corpus name" }]),
  ...[
    ...cases.changes.map(({ id }) => ["changes[].id", id] as const),
    ...cases.weeks.map(({ id }) => ["weeks[].id", id] as const),
    ...cases.closures.map(({ id }) => ["closures[].id", id] as const),
    ...cases.courses.map(({ id }) => ["courses[].id", id] as const),
    ...cases.terms.map(({ id }) => ["terms[].id", id] as const),
  ].flatMap(([path, id]) =>
    identifier.test(id) ? [] : [{ path: `cases.${path}`, problem: "an id that isn't a case name" }],
  ),
  ...cases.weeks.flatMap(({ week, label }) =>
    /^\d{4}-W\d{2}$/u.test(week) && /^[A-Z]$/u.test(label)
      ? []
      : [{ path: "cases.weeks[]", problem: "a week or label of another shape" }],
  ),
];

/**
 * Fails unless the manifest and cases hold only names and labels of their shape, every read
 * follows the policy, and every string is a token, a date or time, or a kept word or phrase the
 * manifest lists.
 */
export const grammar = Effect.fn("Checks.grammar")(function* <E, R>(input: {
  readonly manifest: Corpus.Manifest;
  readonly cases: Corpus.Cases;
  readonly reads: Reads<E, R>;
}) {
  const problems = Policy.tally();
  const kept = input.manifest.kept;

  if (input.manifest.policy !== Policy.version || kept === undefined) {
    return yield* new GrammarFailed({
      problems: [
        { read: "manifest", path: "policy", problem: "not pseudonymized by this policy", count: 1 },
      ],
    });
  }

  problems.add("manifest", headProblems(input.manifest, input.cases));

  const vocabulary = new Set(kept.vocabulary.map(({ value }) => value));
  const phrases = new Set(kept.phrases.map(({ value }) => value));

  const inVocabulary = (value: string) =>
    value === "" || Pseudonymizer.isDateOrTime(value) || vocabulary.has(value);

  /** The value if `fits`, else the problem: a check passes values on unchanged. */
  const check = (value: Policy.Json, fits: boolean, problem: string) =>
    fits ? Result.succeed(value) : Result.fail(problem);

  const isToken = (value: string, kind: string) =>
    Tokens.name.test(value) && value.startsWith(kind);

  const handlers: Policy.Handlers = {
    leaf: (leaf, value) => {
      if (value === null) return Result.succeed(value);

      const text = Predicate.isString(value) ? value : undefined;

      switch (leaf._tag) {
        case "Keep":
          return Policy.isObject(value) || Array.isArray(value)
            ? Result.fail("a list or object where a plain value belongs")
            : check(
                value,
                text === undefined || inVocabulary(text),
                "a string outside the vocabulary",
              );
        case "Drop":
          return Result.fail("a field the policy drops");
        case "Constant":
          return check(value, Equal.equals(value, leaf.value), "a value other than its constant");
        case "Text":
          return check(
            value,
            text !== undefined &&
              (text.trim() === "" || phrases.has(text) || Tokens.text.test(text)),
            "text that is neither a kept phrase nor a token",
          );
        case "Room":
          return check(
            value,
            text !== undefined &&
              ((inVocabulary(text) && (text === "" || Pseudonymizer.isRoomNumber(text))) ||
                isToken(text, "R")),
            "a room that is neither a room number nor a token",
          );
        case "Code":
          return check(
            value,
            text !== undefined && inVocabulary(text),
            "a code outside the vocabulary",
          );
        case "PersonId":
          return check(
            value,
            Predicate.isNumber(value) && Tokens.isId(value),
            "an id outside the pseudonym range",
          );
        case "PersonName":
          return check(
            value,
            text !== undefined && (text === "" || isToken(text, leaf.kind)),
            "a name that isn't a token",
          );
      }
    },
  };

  yield* Stream.runForEach(input.reads, ([name, read]) =>
    Effect.sync(() => {
      const rules = Policy.forRead(name);

      if (rules === undefined) {
        problems.add(name, [{ path: "", problem: "a read without rules" }]);

        return;
      }

      const person = rules.view === undefined ? undefined : Policy.personOfView(rules.view.type);

      if (person !== undefined && rules.view !== undefined && !Tokens.isId(rules.view.resource)) {
        problems.add(name, [{ path: "", problem: "a person's view under a real id" }]);
      }

      for (const version of read.versions) {
        problems.add(name, Policy.walk(rules.node, version.body, handlers).problems);
      }
    }),
  );

  const found = problems.list();

  if (found.length > 0) return yield* new GrammarFailed({ problems: found });
});

/**
 * Fails unless a corpus directory holds nothing but its manifest, its labelled cases and its
 * reads, so a fetch publishes only what the grammar checked.
 */
export const layout = Effect.fn("Checks.layout")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const all = yield* fs.readDirectory(directory, { recursive: true });

  const strays = yield* Effect.filter(all, (file) => {
    const name = file.split(path.sep).join("/");

    if (name === "manifest.json" || name === "truth/cases.json") return Effect.succeed(false);

    if (name === "truth" || name === "reads" || name.startsWith("reads/")) {
      return Effect.map(
        fs.stat(path.join(directory, file)),
        (info) => !(info.type === "Directory" || (info.type === "File" && name.endsWith(".json"))),
      );
    }

    return Effect.succeed(true);
  });

  if (strays.length > 0) {
    return yield* new GrammarFailed({
      problems: [
        {
          read: "layout",
          path: "",
          problem: "a file a corpus doesn't hold",
          count: strays.length,
        },
      ],
    });
  }
});
