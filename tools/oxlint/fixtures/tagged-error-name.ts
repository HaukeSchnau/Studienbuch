import * as Data from "effect/Data";

export class NotFound extends Data.TaggedError("Homework.NotFound") {}

// oxlint-disable-next-line studienbuch/tagged-error-name -- fixture: an Error suffix
export class RefusedError extends Data.TaggedError("Homework.RefusedError") {}

export class Missing extends Data.TaggedError(
  // oxlint-disable-next-line studienbuch/tagged-error-name -- fixture: a tag without its domain
  "Missing",
) {}
