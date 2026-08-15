import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";
import * as AggregateRevision from "./aggregate-revision";
import * as Artifact from "./artifact";
import * as NonBlankText from "./non-blank-text";

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
  it("accepts only trimmed non-empty text", () => {
    expect(Option.isSome(NonBlankText.fromString("Lesson notes"))).toBe(true);
    expect(Option.isNone(NonBlankText.fromString(""))).toBe(true);
    expect(Option.isNone(NonBlankText.fromString(" padded "))).toBe(true);
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
