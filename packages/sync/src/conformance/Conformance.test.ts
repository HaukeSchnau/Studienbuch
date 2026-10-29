import { expect, layer } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Sync } from "../definition/Sync.ts";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import { Tx } from "../transaction/Tx.ts";
import { Cases } from "./Cases.ts";
import { Engines } from "./Engines.ts";
import { Probe } from "./Probe.ts";

const pick = <const A>(values: ReadonlyArray<A>) =>
  Arbitrary.map(
    Arbitrary.schema(
      Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: values.length - 1 })),
    ),
    (index) => Arr.getUnsafe(values, index),
  );

const either = <A, B>(left: Arbitrary.Arbitrary<A>, right: Arbitrary.Arbitrary<B>) =>
  Arbitrary.flatMap(Arbitrary.schema(Schema.Boolean), (useLeft): Arbitrary.Arbitrary<A | B> =>
    useLeft ? left : right,
  );

const ids = ["a", "B", "_c", "é", "é", "😀", "", "10", "9", ""] as const;

const text = Arbitrary.map(
  Arbitrary.array(
    pick(
      ["a", "Z", "_", " ", "é", "é", "ﬀ", "😀", "", "￿", " ", "\u0001"].concat([
        '"',
        "\\",
        "10",
        "9",
        "\u0000",
        "\ud800",
        "\udc00",
      ]),
    ),
    { maxLength: 5 },
  ),
  (parts) => parts.join(""),
);

const amount = either(
  pick(
    [0, -0, 1, -1, 12.5, 0.1, 0.1 + 0.2, 1e-7, 5e-324, 2 ** 53 - 1, -(2 ** 53 - 1)].concat([
      2 ** 53,
      2 ** 60,
      1e21,
      Number.MAX_VALUE,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]),
  ),
  Arbitrary.schema(Schema.Finite),
);

const keys = [1, "1", true, "true", false, 0, null, [1], { a: 1 }, '{"a":1}', 12.5, "é"] as const;
const groups = ["é", "é", "É", "a", "A", ""] as const;

const nested = Arbitrary.schema(Schema.Json);

const row = Arbitrary.map(
  Arbitrary.all({
    text,
    amount,
    flag: Arbitrary.schema(Schema.Boolean),
    note: pick([undefined, null, "x", "é"]),
    nested,
    group: pick(groups),
    key: pick(keys),
  }),
  ({ note, ...fields }): Probe.Row => (note === undefined ? fields : { ...fields, note }),
);

const fieldNames = ["text", "amount", "flag", "note", "nested", "group", "key"] as const;

const step: Arbitrary.Arbitrary<Probe.Step> = Arbitrary.flatMap(
  pick(["insert", "put", "patch", "remove", "get", "list", "filter"]),
  (op): Arbitrary.Arbitrary<Probe.Step> => {
    switch (op) {
      case "insert":
      case "put":
        return Arbitrary.map(
          Arbitrary.all({
            id: pick(ids),
            row,
            unset: Arbitrary.array(pick(fieldNames), { maxLength: 1 }),
          }),
          (args) => ({ op, ...args }),
        );
      case "patch":
        return Arbitrary.map(
          Arbitrary.all({
            id: pick(ids),
            row,
            set: Arbitrary.array(pick(fieldNames), { maxLength: 3 }),
            unset: Arbitrary.array(pick(fieldNames), { maxLength: 1 }),
          }),
          ({ id, row, set, unset }) => ({
            op,
            id,
            fields: Object.fromEntries(set.map((field) => [field, row[field]])),
            unset,
          }),
        );
      case "remove":
      case "get":
        return Arbitrary.map(pick(ids), (id) => ({ op, id }));
      case "list":
        return Arbitrary.Constant({ op });
      case "filter":
        return Arbitrary.flatMap(pick(["group", "key", "amount"]), (index) =>
          Arbitrary.map(
            (index === "group"
              ? pick(groups)
              : index === "key"
                ? pick(keys)
                : amount) as Arbitrary.Arbitrary<unknown>,
            (equals): Probe.Step => ({ op: "list", where: { index, equals } }),
          ),
        );
    }
  },
);

/**
 * Rows the server delivered before the commands ran. A row delivered later reaches the device
 * through a rebase, which clears the overlay, so seeding it mid-sequence would compare a device
 * that never rebased with a server.
 */
const seed: Arbitrary.Arbitrary<Probe.Step> = Arbitrary.map(
  Arbitrary.all({ id: pick(ids), row, extra: nested }),
  ({ id, row, extra }) => ({ op: "seed", id, json: { ...row, extra } }),
);

/** The fixture keeps numbers JSON can't hold as `{ "$number": "NaN" }`. */
// JSON.stringify hands its replacer every value untyped.
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- see above
const fixtureNumbers = (_key: string, value: unknown) =>
  Predicate.isNumber(value) && !Number.isFinite(value) ? { $number: String(value) } : value;

const agree = (steps: ReadonlyArray<Probe.Step>) =>
  Effect.gen(function* () {
    const engines = yield* Engines.Service;
    const space = Probe.freshSpace();
    const traces = yield* Effect.forEach(engines, (engine) => Probe.run(engine, space, steps));

    for (const [index, engine] of engines.entries()) {
      expect(traces[index], `${engine.name} against ${Arr.getUnsafe(engines, 0).name}`).toEqual(
        traces[0],
      );
    }

    return Arr.getUnsafe(traces, 0);
  });

layer(Engines.layer)("Tx conformance", (it) => {
  it.effect("every hand-written case ends the same on every engine", () =>
    Effect.gen(function* () {
      const cases = [];

      for (const { name, steps } of Cases.all) {
        const { outcomes, stored } = yield* agree(steps);
        cases.push({ name, steps, outcomes, stored });
      }

      // JSON Lines: a header, then one case per line, which a device can replay one at a time.
      const engines = (yield* Engines.Service).map((engine) => engine.name);

      const lines = [{ table: Probe.table.name, engines }, ...cases].map((line) =>
        JSON.stringify(line, fixtureNumbers),
      );

      yield* Effect.promise(() =>
        expect(`${lines.join("\n")}\n`).toMatchFileSnapshot("./cases.jsonl"),
      );
    }),
  );

  it.effect("a mutator runs on the client on SQLite and on the server on Postgres", () =>
    Effect.gen(function* () {
      for (const engine of yield* Engines.Service) {
        const location = yield* engine.transaction(Effect.map(Tx.Service, (tx) => tx.location));

        expect(location, engine.name).toBe(engine.side === "device" ? "client" : "server");
      }
    }),
  );

  it.effect("a Tx writes only its command's tables, and the server's never an encrypted one", () =>
    Effect.gen(function* () {
      const Undeclared = Sync.table("Undeclared", { class: "readable", fields: {} });
      const Secret = Sync.table("Secret", { class: "encrypted", fields: {} });

      const dies = <A, E>(effect: Effect.Effect<A, E, Tx.Service>, engine: Engines.Engine) =>
        Effect.map(
          Effect.exit(engine.transaction(effect)),
          (exit) => Exit.isFailure(exit) && Cause.hasDies(exit.cause),
        );

      for (const engine of yield* Engines.Service) {
        const outcomes = [
          yield* dies(
            Effect.flatMap(Tx.Service, (tx) => tx.put(Undeclared, "guard", "a", {})),
            engine,
          ),
          yield* dies(
            Effect.flatMap(Tx.Service, (tx) => tx.get(Secret, "guard", "a")),
            engine,
          ),
        ];

        expect(outcomes, engine.name).toEqual([true, engine.side === "server"]);
      }
    }),
  );

  it.effect.prop(
    "generated steps end the same on every engine",
    {
      seeds: Arbitrary.array(seed, { maxLength: 3 }),
      steps: Arbitrary.array(step, { maxLength: 10 }),
    },
    ({ seeds, steps }) => Effect.asVoid(agree([...seeds, ...steps])),
    { arbitrary: { runs: 150 } },
  );

  it.effect.prop(
    "a row stored on SQLite keeps its canonical text through Postgres jsonb",
    { row },
    ({ row }) =>
      Effect.gen(function* () {
        const engines = yield* Engines.Service;
        const json = yield* Probe.encode(row);
        const encoded = CanonicalJson.encode(json);

        if (encoded._tag === "Failure") return;

        for (const engine of engines.filter((each) => each.side === "server")) {
          const rows = yield* engine.sql(
            Effect.flatMap(
              SqlClient.SqlClient,
              (sql) =>
                sql<{ readonly text: string }>`select (${encoded.success}::jsonb)::text as text`,
            ),
          );

          const normalized = yield* Effect.fromResult(
            CanonicalJson.normalize(Arr.getUnsafe(rows, 0).text),
          );

          expect(normalized, engine.name).toBe(encoded.success);
        }
      }),
    { arbitrary: { runs: 300 } },
  );
});
