import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";
import { AggregateRevision } from "./aggregate-revision";
import { Artifact } from "./artifact";
import { NonBlankText } from "./non-blank-text";

describe("AggregateRevision", () => {
  it("starts at zero and advances monotonically", () => {
    const next = AggregateRevision.unsafeNext(AggregateRevision.initial);
    expect(AggregateRevision.next(AggregateRevision.initial)).toEqual(Option.some(next));
    expect(AggregateRevision.compare(AggregateRevision.initial, next)).toBe(-1);
    expect(AggregateRevision.Equivalence(next, AggregateRevision.Schema.make(1))).toBe(true);
    expect(AggregateRevision.next(AggregateRevision.Schema.make(Number.MAX_SAFE_INTEGER))).toEqual(
      Option.none(),
    );
  });
});

describe("NonBlankText", () => {
  it("accepts non-empty literals without construction", () => {
    const latin: NonBlankText.Type = "Untis";
    const unicode: NonBlankText.Type = "数学";

    expect(latin).toBe("Untis");
    expect(unicode).toBe("数学");

    // @ts-expect-error An empty literal is not non-blank text.
    const empty: NonBlankText.Type = "";
    // @ts-expect-error A dynamic string must be decoded because it may be blank.
    const dynamic: NonBlankText.Type = String(Date.now());
    void [empty, dynamic];
  });

  it("accepts only trimmed non-empty text", () => {
    expect(Option.isSome(NonBlankText.fromString("Lesson notes"))).toBe(true);
    expect(Option.isNone(NonBlankText.fromString(""))).toBe(true);
    expect(Option.isNone(NonBlankText.fromString("   "))).toBe(true);
    expect(Option.isNone(NonBlankText.fromString(" padded "))).toBe(true);
  });

  it("round-trips as an ordinary string", () => {
    const text: NonBlankText.Type = "Lesson notes";
    const encoded = Schema.encodeSync(NonBlankText.Schema)(text);

    expect(encoded).toBe("Lesson notes");
    expect(Schema.decodeSync(NonBlankText.Schema)(encoded)).toBe(text);
  });
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

    expect(Schema.is(Artifact.Reference)(reference)).toBe(true);
    expect(Artifact.MediaType.makeOption("not-a-media-type")).toEqual(Option.none());
  });
});
