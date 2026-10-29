import { AccountKey, CryptoSuite, SealedRow, SpaceKey, Wrapper } from "@stu/e2ee";
import { Vectors } from "@stu/e2ee/vectors";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Redacted from "effect/Redacted";
import * as Atom from "effect/reactivity/Atom";

// On every start, the device computes every vector of packages/e2ee with its own crypto stack
// (quick-crypto on iOS and Android, the browser's WebCrypto on the web), then times the operations
// whose cost a student would feel. Node runs the same checks in CryptoSelfTest.test.ts.

export * as CryptoSelfTest from "./CryptoSelfTest.ts";

export interface Outcome {
  readonly name: string;
  readonly status: "passed" | "failed" | "unsupported";
  /** What passed, or why not. */
  readonly detail: string;
  readonly duration: Duration.Duration;
}

const milliseconds = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 });

const reason = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause);

  return error instanceof Error ? error.message : String(error);
};

/** Prepares with `setup`, then times `measured` alone and describes the result. */
const timing = <S, E>(
  name: string,
  setup: Effect.Effect<S, E, CryptoSuite.Service>,
  measured: (prepared: S) => Effect.Effect<unknown, E, CryptoSuite.Service>,
  describe: (duration: Duration.Duration) => string,
) =>
  setup.pipe(
    Effect.flatMap((prepared) => Effect.timed(measured(prepared))),
    Effect.provide(CryptoSuite.layer),
    Effect.exit,
    Effect.map((exit): Outcome =>
      Exit.isSuccess(exit)
        ? { name, status: "passed", detail: describe(exit.value[0]), duration: exit.value[0] }
        : { name, status: "failed", detail: reason(exit.cause), duration: Duration.zero },
    ),
  );

const randomness = timing(
  "Zufallszahlen",
  Effect.void,
  Effect.fnUntraced(function* () {
    const suite = yield* CryptoSuite.Service;
    const first = yield* suite.randomBytes(32);
    const second = yield* suite.randomBytes(32);

    if (first.every((byte, index) => byte === second[index])) {
      return yield* Effect.die(new Error("Zwei Ziehungen sind gleich"));
    }
  }),
  () => "Zwei Ziehungen à 32 Byte unterscheiden sich",
);

const rowCount = 1000;
const key = Redacted.make(new Uint8Array(32).fill(1));

const sealedRows = Effect.forEach(
  Array.from({ length: rowCount }, (_, index) => index),
  (index) => {
    const row = {
      space: "selbsttest",
      id: `row-${index}`,
      table: "Homework",
      json: `{"courseId":"course-ma23","dueOn":"2026-11-02","title":"Aufgabe ${index}"}`,
    };

    return Effect.map(SealedRow.seal(row, "konto", 0, key), (sealed) => ({ row, sealed }));
  },
);

const openRows = timing(
  "1.000 Zeilen öffnen",
  sealedRows,
  (prepared) =>
    Effect.forEach(prepared, ({ row, sealed }) =>
      SealedRow.open(row, sealed.envelope, sealed.ct, key),
    ),
  (duration) => `${milliseconds.format(Duration.toMillis(duration) / rowCount)} ms je Zeile`,
);

const account = Effect.gen(function* () {
  const keys = yield* AccountKey.generate("konto", 0);

  return { keys, record: yield* AccountKey.record(keys, "first") };
});

const epochKey = { epoch: 0, key };

const sealBox = timing(
  "Schlüsselbox versiegeln",
  account,
  ({ keys, record }) => SpaceKey.box("selbsttest", [epochKey], record, keys),
  () => "X-Wing, HKDF, AES-GCM und Ed25519",
);

const openBox = timing(
  "Schlüsselbox öffnen",
  Effect.gen(function* () {
    const { keys, record } = yield* account;
    const box = yield* SpaceKey.box("selbsttest", [epochKey], record, keys);

    return { keys, record, box };
  }),
  ({ keys, record, box }) => SpaceKey.openBox(box, "selbsttest", keys, record),
  () => "Signatur geprüft, X-Wing entkapselt",
);

const code = Redacted.make(new Uint8Array(16).fill(7));
const card = { id: "karte", kind: "code", place: "card", credentialId: "" } as const;

const recover = timing(
  "Mit der Notfallkarte entsperren",
  Effect.gen(function* () {
    const { keys, record } = yield* account;
    const { statement, seal } = yield* Wrapper.create(card, code, keys);

    return { record, statement, seal };
  }),
  ({ record, statement, seal }) =>
    Wrapper.recover("code", code, "konto", statement, seal, [record]),
  () => "Anker, Kette, Bestätigung und Schlüssel geprüft",
);

const vectors = Effect.map(Vectors.run, (outcomes) =>
  outcomes.map(({ title, status, detail, duration }): Outcome => ({
    name: title,
    status,
    detail,
    duration,
  })),
);

/** Every check and timing, one after another so each one's time is its own. */
export const run = Effect.gen(function* () {
  const first = yield* randomness;
  const checked = yield* vectors;
  const timed = yield* Effect.all([openRows, sealBox, openBox, recover]);

  return [first, ...checked, ...timed];
});

/** The outcomes of this start's run. Refresh it to check again. */
export const outcomes = Atom.make(run).pipe(Atom.keepAlive);
