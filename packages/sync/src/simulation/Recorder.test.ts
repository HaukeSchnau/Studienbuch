import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Schema from "effect/Schema";
import { Leaks } from "./Leaks.ts";
import { Recorder } from "./Recorder.ts";

const marker = Leaks.marker(7);

class Refused extends Schema.TaggedError<Refused, { readonly brand: unique symbol }>()(
  "Test.Refused",
  { message: Schema.String },
) {}

const recorded = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    const recorder = yield* Recorder.make;

    yield* Effect.exit(Effect.provide(effect, recorder.layer));

    return recorder.lines();
  });

describe("Recorder", () => {
  it.effect("keeps debug logs with their annotations, as text the leak check reads", () =>
    Effect.gen(function* () {
      const lines = yield* recorded(
        Effect.logDebug("pushed").pipe(Effect.annotateLogs("row", { title: marker })),
      );

      expect(lines.flatMap((line) => Leaks.find("log", line))).toHaveLength(1);
    }),
  );

  it.effect("keeps span attributes, bytes included, and the cause of a failed span", () =>
    Effect.gen(function* () {
      const bytes = new TextEncoder().encode(marker);

      const lines = yield* recorded(
        Effect.fail(new Refused({ message: `refused ${marker}` })).pipe(
          Effect.withSpan("Sync.push", { attributes: { ct: bytes } }),
        ),
      );

      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("Sync.push");
      expect(lines[0]).toContain(`hex:${Hex.encode(bytes)}`);
      expect(lines[0]).toContain(`refused ${marker}`);
    }),
  );

  it.effect("numbers spans the same way on every run", () =>
    Effect.gen(function* () {
      const program = Effect.withSpan(Effect.withSpan(Effect.void, "inner"), "outer");

      const first = yield* recorded(program);
      const second = yield* recorded(program);

      expect(first).toStrictEqual(second);
      expect(first).toHaveLength(2);
      expect(first[1]).toContain(`"id":"0000000000000001"`);
    }),
  );
});
