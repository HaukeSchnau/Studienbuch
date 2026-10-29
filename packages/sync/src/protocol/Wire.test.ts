/**
 * `wire.jsonl` holds messages and whole frames as clients and servers of earlier releases send
 * them, one JSON object per line. Add lines and never edit or remove one: a line that stops
 * decoding, or comes back as other JSON, is a change that breaks an app already on phones.
 */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Rpc from "effect/rpc/Rpc";
import type * as RpcMessage from "effect/rpc/RpcMessage";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as Schema from "effect/Schema";
// The fixtures are read once while the test file loads, before any Effect runs.
// oxlint-disable-next-line effecttsgo/node-builtin-import -- see above
import * as NodeFS from "node:fs";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import type { Tx } from "../transaction/Tx.ts";
import type { Command } from "./Command.ts";
import { Protocol } from "./Protocol.ts";
import { Wire } from "./Wire.ts";

const fixture = (name: string) =>
  Effect.sync(() => NodeFS.readFileSync(new URL(`./${name}`, import.meta.url), "utf8"));

const MessageLine = Schema.Struct({ message: Schema.String, json: Schema.Json });

/** A frame as Protocol.serialization sends it, and the RPC it belongs to, empty for a ping. */
const FrameLine = Schema.Struct({ frame: Schema.String, text: Schema.String });

const decodeLine = Schema.decodeEffect(
  Schema.fromJsonString(Schema.Union([MessageLine, FrameLine])),
);

const lines = Effect.flatMap(fixture("wire.jsonl"), (text) =>
  Effect.forEach(
    text.split("\n").filter((line) => line !== ""),
    (line, index) => Effect.map(decodeLine(line), (decoded) => ({ line: index + 1, ...decoded })),
  ),
);

const messageLines = Effect.map(lines, (all) =>
  all.flatMap((line) => ("message" in line ? [line] : [])),
);

const frameLines = Effect.map(lines, (all) =>
  all.flatMap((line) => ("frame" in line ? [line] : [])),
);

const RequestId = Schema.Union([Schema.String, Schema.Finite]);

const ExitEncoded = Schema.Union([
  Schema.TaggedStruct("Success", { value: Schema.Json }),
  Schema.TaggedStruct("Failure", {
    cause: Schema.Array(
      Schema.Union([
        Schema.TaggedStruct("Fail", { error: Schema.Json }),
        Schema.TaggedStruct("Die", { defect: Schema.Json }),
        Schema.TaggedStruct("Interrupt", { fiberId: Schema.NullOr(Schema.Finite) }),
      ]),
    ),
  }),
]);

const Frame = Schema.Union([
  Schema.TaggedStruct("Request", {
    id: RequestId,
    tag: Schema.String,
    payload: Schema.Json,
    headers: Schema.Array(Schema.mutable(Schema.Tuple([Schema.String, Schema.String]))),
  }),
  Schema.TaggedStruct("Exit", { requestId: RequestId, exit: ExitEncoded }),
  Schema.TaggedStruct("Chunk", { requestId: RequestId, values: Schema.NonEmptyArray(Schema.Json) }),
  Schema.TaggedStruct("Ack", { requestId: RequestId }),
  Schema.TaggedStruct("Ping", {}),
  Schema.TaggedStruct("Pong", {}),
]);

type Frame = typeof Frame.Type;

/** Effect's own frame types, so a bump that changes a frame's shape stops compiling here. */
const asSent = (frame: Frame): RpcMessage.FromClientEncoded | RpcMessage.FromServerEncoded => frame;

const decodeFrame = Schema.decodeUnknownEffect(Frame);

const parseJson = Schema.decodeEffect(Schema.fromJsonString(Schema.Json));

const asJson = Schema.decodeUnknownEffect(Schema.Json);

const canonical = (json: Schema.Json) => Effect.fromResult(CanonicalJson.encode(json));

type SyncRpc = typeof Protocol.Rpcs.requests extends ReadonlyMap<string, infer R> ? R : never;

type Portable = Schema.Top & { readonly DecodingServices: never; readonly EncodingServices: never };

/** Decodes a frame's schema-encoded part with the protocol's codec and encodes it back. */
const roundTrip = Effect.fnUntraced(function* (
  codecFor: RpcSerialization.CodecFor,
  rpc: SyncRpc | undefined,
  frame: Frame,
) {
  const again = <S extends Portable>(schema: S, hole: Schema.Json) => {
    const codec = codecFor(schema);

    return Effect.flatMap(Schema.decodeEffect(codec)(hole), Schema.encodeEffect(codec));
  };

  if (rpc === undefined) return frame;

  switch (frame._tag) {
    case "Request":
      return yield* decodeFrame({
        ...frame,
        payload: yield* again(rpc.payloadSchema, frame.payload),
      });
    case "Exit":
      return yield* decodeFrame({ ...frame, exit: yield* again(Rpc.exitSchema(rpc), frame.exit) });
    case "Chunk": {
      const values =
        rpc._tag === "Sync.events"
          ? yield* again(Schema.NonEmptyArray(rpc.successSchema.success), frame.values)
          : frame.values;

      return yield* decodeFrame({ ...frame, values });
    }

    case "Ack":
    case "Ping":
    case "Pong":
      return frame;
  }
});

/** Every `_tag` value inside a JSON value. */
const tagsIn = (json: Schema.Json): ReadonlyArray<string> => {
  if (Array.isArray(json)) return json.flatMap(tagsIn);

  if (json === null || Predicate.isString(json) || Predicate.isNumber(json)) return [];

  if (Predicate.isBoolean(json)) return [];

  const entries = Object.entries(json);

  const own = entries.flatMap(([key, value]) =>
    key === "_tag" && Predicate.isString(value) ? [value] : [],
  );

  return [...own, ...entries.flatMap(([, value]) => tagsIn(value))];
};

/** Tags that only devices send, and the `Tx` errors that travel as refusal reasons. */
const otherTags = {
  Mutate: true,
  Seal: true,
  AtVersion: true,
  Absent: true,
  AfterMutation: true,
  "Tx.RowExists": true,
  "Tx.RowMissing": true,
  "Tx.InvalidRow": true,
  "Tx.InvalidId": true,
  "CanonicalJson.Unrepresentable": true,
} as const satisfies {
  readonly [tag in Command.Any["_tag"] | Command.Base["_tag"] | Tx.Refused["_tag"]]: true;
};

const frameTags: ReadonlyArray<Frame["_tag"]> = ["Request", "Exit", "Chunk", "Ack", "Ping", "Pong"];

describe("wire.jsonl", () => {
  it.effect("has a line for every message", () =>
    Effect.gen(function* () {
      const covered = new Set((yield* messageLines).map(({ message }) => message));

      expect([...Wire.messages.keys()].filter((message) => !covered.has(message))).toEqual([]);
    }),
  );

  it.effect("has a line with every tag", () =>
    Effect.gen(function* () {
      const seen = new Set<string>();

      for (const line of yield* lines) {
        const json = "json" in line ? line.json : yield* parseJson(line.text);

        for (const tag of tagsIn(json)) seen.add(tag);
      }

      const required = [...Object.keys(Protocol.since), ...Object.keys(otherTags), ...frameTags];

      expect(required.filter((tag) => !seen.has(tag))).toEqual([]);
    }),
  );

  it.effect("every message decodes and encodes back to the same JSON", () =>
    Effect.gen(function* () {
      for (const { line, message, json } of yield* messageLines) {
        const schema = Wire.messages.get(message);

        expect(schema, `line ${line} names no message`).toBeDefined();

        if (schema === undefined) continue;
        const codec = Schema.toCodecJson(schema);
        const encoded = yield* Schema.encodeEffect(codec)(yield* Schema.decodeEffect(codec)(json));

        expect(yield* canonical(encoded), `line ${line}, ${message}`).toBe(yield* canonical(json));
      }
    }),
  );

  it.effect("every frame parses as Effect sends it and encodes back the same", () =>
    Effect.gen(function* () {
      const serialization = yield* RpcSerialization.RpcSerialization;
      const parser = serialization.makeUnsafe();

      for (const { line, frame: tag, text } of yield* frameLines) {
        const parsed = yield* asJson(parser.decode(text)[0]);
        const frame = yield* decodeFrame(parsed);
        const rpc = tag === "" ? undefined : Protocol.Rpcs.requests.get(tag);
        const again = parser.encode(asSent(yield* roundTrip(serialization.codecFor, rpc, frame)));

        expect(yield* canonical(yield* parseJson(String(again))), `line ${line}`).toBe(
          yield* canonical(parsed),
        );
      }
    }).pipe(Effect.provide(Protocol.serialization)),
  );
});

describe("Protocol versions", () => {
  it("never names a version newer than the protocol's", () => {
    expect(Math.max(...Object.values(Protocol.since))).toBeLessThanOrEqual(Protocol.version);
  });

  it.effect("records every message of this version in its schema file", () =>
    Effect.gen(function* () {
      const recorded = yield* parseJson(yield* fixture(`wire.v${Protocol.version}.schema.json`));
      const current = yield* asJson(Wire.schemas());

      expect(yield* canonical(current), "a changed message needs a new version").toBe(
        yield* canonical(recorded),
      );
    }),
  );
});
