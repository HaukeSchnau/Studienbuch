import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { AggregateRevision } from "./aggregate-revision";
import { Artifact } from "./artifact";
import { NonBlankText } from "./non-blank-text";

describe("AggregateRevision", () => {
  it.effect("starts at zero, advances monotonically, and reports exhaustion", () =>
    Effect.gen(function* () {
      const next = yield* AggregateRevision.next(AggregateRevision.initial);
      assert.strictEqual(AggregateRevision.compare(AggregateRevision.initial, next), -1);
      assert.strictEqual(next, AggregateRevision.Schema.make(1));
      const exhausted = yield* Effect.flip(
        AggregateRevision.next(AggregateRevision.Schema.make(Number.MAX_SAFE_INTEGER)),
      );
      assert.strictEqual(exhausted._tag, "AggregateRevision.Exhausted");
    }),
  );
});

describe("NonBlankText", () => {
  it("accepts non-empty literals without construction", () => {
    const latin: NonBlankText = "Untis";
    const unicode: NonBlankText = "数学";

    assert.strictEqual(latin, "Untis");
    assert.strictEqual(unicode, "数学");

    // @ts-expect-error An empty literal is not non-blank text.
    const empty: NonBlankText = "";
    // @ts-expect-error A dynamic string must be decoded because it may be blank.
    const dynamic: NonBlankText = String(Date.now());
    void [empty, dynamic];
  });

  it.effect("validates non-blank text while preserving authored spacing", () =>
    Effect.gen(function* () {
      const text = yield* Schema.decodeEffect(NonBlankText)("Lesson notes");
      assert.strictEqual(text, "Lesson notes");
      for (const invalid of ["", "   "]) {
        yield* Schema.decodeEffect(NonBlankText)(invalid).pipe(Effect.flip);
      }
      assert.strictEqual(yield* Schema.decodeEffect(NonBlankText)(" padded "), " padded ");
    }),
  );

  it.effect("round-trips as an ordinary string", () =>
    Effect.gen(function* () {
      const text: NonBlankText = "Lesson notes";
      const encoded = yield* Schema.encodeEffect(NonBlankText)(text);

      assert.strictEqual(encoded, "Lesson notes");
      assert.strictEqual(yield* Schema.decodeEffect(NonBlankText)(encoded), text);
    }),
  );
});

describe("Artifact", () => {
  it("models storage-independent identity and integrity metadata", () => {
    const reference = Artifact.Reference.make({
      id: Artifact.Id.make("artifact-1"),
      mediaType: Artifact.MediaType.make("application/pdf"),
      contentDigest: Artifact.ContentDigest.make({
        algorithm: "sha256",
        value: "abc123==",
      }),
    });

    assert.isTrue(Schema.is(Artifact.Reference)(reference));
    assert.isFalse(Schema.is(Artifact.MediaType)("not-a-media-type"));
  });
});
