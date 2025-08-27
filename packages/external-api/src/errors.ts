import { Data } from "effect";

export class ExternalApiError extends Data.TaggedError("ExternalApiError")<{ cause: unknown }> {}
