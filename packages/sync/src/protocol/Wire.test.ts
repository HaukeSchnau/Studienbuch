/**
 * `wire.jsonl` holds messages as clients and servers of earlier releases encode them, one JSON
 * object per line. Add lines and never edit or remove one: a line that stops decoding, or comes
 * back as other JSON, is a change that breaks an app already on phones.
 */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as RpcSchema from "effect/rpc/RpcSchema";
import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
// The fixture is read once while the test file loads, before any Effect runs.
// oxlint-disable-next-line effecttsgo/node-builtin-import -- see above
import * as NodeFS from "node:fs";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import { Connection } from "./Connection.ts";
import { Protocol } from "./Protocol.ts";
import { Refusal } from "./Refusal.ts";

/** Every message, by the name its lines carry. */
const messages = new Map<string, Schema.Codec<unknown, unknown>>([
  ["Refusal.Engine", Refusal.Engine],
  ["Connection.Ticket", Connection.Ticket],
]);

for (const [tag, rpc] of Protocol.Rpcs.requests) {
  const parts = RpcSchema.isStreamSchema(rpc.successSchema)
    ? {
        payload: rpc.payloadSchema,
        chunk: rpc.successSchema.success,
        error: rpc.successSchema.error,
      }
    : { payload: rpc.payloadSchema, success: rpc.successSchema, error: rpc.errorSchema };

  for (const [part, schema] of Object.entries(parts)) {
    const { ast } = schema;

    if (!SchemaAST.isNever(ast) && !SchemaAST.isVoid(ast)) messages.set(`${tag} ${part}`, schema);
  }
}

const decodeLine = Schema.decodeEffect(
  Schema.fromJsonString(Schema.Struct({ message: Schema.String, json: Schema.Json })),
);

const lines = Effect.sync(() =>
  NodeFS.readFileSync(new URL("./wire.jsonl", import.meta.url), "utf8"),
).pipe(
  Effect.flatMap((text) =>
    Effect.forEach(
      text.split("\n").filter((line) => line !== ""),
      (line, index) => Effect.map(decodeLine(line), (decoded) => ({ line: index + 1, ...decoded })),
    ),
  ),
);

const canonical = (json: Schema.Json) => Effect.fromResult(CanonicalJson.encode(json));

describe("wire.jsonl", () => {
  it.effect("has a line for every message", () =>
    Effect.gen(function* () {
      const covered = new Set((yield* lines).map(({ message }) => message));

      expect([...messages.keys()].filter((message) => !covered.has(message))).toEqual([]);
    }),
  );

  it.effect("every line decodes and encodes back to the same JSON", () =>
    Effect.gen(function* () {
      for (const { line, message, json } of yield* lines) {
        const schema = messages.get(message);

        expect(schema, `line ${line} names no message`).toBeDefined();

        if (schema === undefined) continue;
        const codec = Schema.toCodecJson(schema);
        const encoded = yield* Schema.encodeEffect(codec)(yield* Schema.decodeEffect(codec)(json));

        expect(yield* canonical(encoded), `line ${line}, ${message}`).toBe(yield* canonical(json));
      }
    }),
  );
});
