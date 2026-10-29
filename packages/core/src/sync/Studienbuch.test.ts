/**
 * Phones and the server hold rows and queued commands written by every earlier version, so a
 * version may only add. To raise `Studienbuch.version`, save the snapshot that the failing test
 * prints as `schema.v<version>.json` and import it below.
 */
import { describe, expect, it } from "@effect/vitest";
import { Evolution, Sync } from "@stu/sync";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { Studienbuch } from "./Studienbuch.ts";
import v1 from "./schema.v1.json" with { type: "json" };

const Document = Schema.Struct({
  dialect: Schema.Literal("draft-2020-12"),
  schema: Schema.Record(Schema.String, Schema.Json),
  definitions: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Json)),
});

const Snapshot = Schema.Struct({
  schema: Schema.Int,
  tables: Schema.Record(
    Schema.String,
    Schema.Struct({
      class: Schema.Literals(["readable", "encrypted"]),
      fields: Schema.Record(Schema.String, Document),
      required: Schema.Array(Schema.String),
    }),
  ),
  mutators: Schema.Record(Schema.String, Document),
});

const decodeSnapshot = Schema.decodeUnknownEffect(Snapshot);

const committed = Effect.forEach([v1], (snapshot) => decodeSnapshot(snapshot));

const toJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

const current = Evolution.snapshot(Studienbuch.schema);

describe("Studienbuch.schema", () => {
  it("keeps every rule of the definition API", () => {
    const failure = Result.match(Sync.validate(Studienbuch.schema), {
      onSuccess: () => null,
      onFailure: ({ reason, subject }) => ({ reason, subject }),
    });

    expect(failure).toBeNull();
  });

  it.effect("matches the committed snapshot of its version", () =>
    Effect.gen(function* () {
      const recorded = (yield* committed).find(({ schema }) => schema === Studienbuch.version);

      expect(
        recorded,
        `schema.v${Studienbuch.version}.json is missing: ${yield* toJson(current)}`,
      ).toBeDefined();
      expect(current, "a changed schema needs a new version").toEqual(recorded);
    }),
  );

  it.effect("breaks no earlier version", () =>
    Effect.gen(function* () {
      const previous = yield* committed;

      expect(previous.flatMap((snapshot) => Evolution.breakingChanges(snapshot, current))).toEqual(
        [],
      );
    }),
  );
});
