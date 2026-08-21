import * as Schema_ from "effect/Schema";

const trimmedNonEmpty = Schema_.String.check(Schema_.isTrimmed(), Schema_.isNonEmpty());
const mediaTypePattern = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+\/[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;
const digestAlgorithmPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const digestValuePattern = /^\S+$/;

/** Stable identifier for externally managed immutable content. */
export const Id = trimmedNonEmpty.pipe(Schema_.brand("ArtifactId"));
export type Id = typeof Id.Type;

/** An IANA-style media type such as `image/jpeg` or `application/pdf`. */
export const MediaType = trimmedNonEmpty
  .check(
    Schema_.makeFilter((value) => mediaTypePattern.test(value), {
      expected: "a media type in type/subtype form",
    }),
  )
  .pipe(Schema_.brand("ArtifactMediaType"));
export type MediaType = typeof MediaType.Type;

/** Algorithm name paired with its encoded digest value. */
export const ContentDigest = Schema_.Struct({
  algorithm: trimmedNonEmpty.check(
    Schema_.makeFilter((value) => digestAlgorithmPattern.test(value), {
      expected: "a digest algorithm token",
    }),
  ),
  value: trimmedNonEmpty.check(
    Schema_.makeFilter((value) => digestValuePattern.test(value), {
      expected: "a digest value without whitespace",
    }),
  ),
});
export type ContentDigest = typeof ContentDigest.Type;

/**
 * Storage-independent reference to immutable content managed outside core.
 * Core records identity and integrity metadata, never a local path or URL.
 */
export const Reference = Schema_.Struct({
  id: Id,
  mediaType: MediaType,
  contentDigest: Schema_.optional(ContentDigest),
});
export type Reference = typeof Reference.Type;

export * as Artifact from "./artifact";
