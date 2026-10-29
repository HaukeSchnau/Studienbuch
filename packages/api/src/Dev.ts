import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Schema from "effect/Schema";

// Shortcuts for the Sync Lab and E2E runs: a fresh school, and the caller's admission to it. Every
// server has them, and only development and preview servers answer, to a signed-in account. Ids
// are plain strings, so the console's bundle stays free of the domain.

export * as Dev from "./Dev.ts";

/** A school that `Dev.createSchool` made, with today's term and the courses it offers there. */
export class School extends Schema.Class<School, { readonly brand: unique symbol }>("Dev.School")({
  id: Schema.String,
  termId: Schema.String,
  courseIds: Schema.Array(Schema.String),
}) {}

/** The caller's notebook at the school. */
export class Admission extends Schema.Class<Admission, { readonly brand: unique symbol }>(
  "Dev.Admission",
)({
  notebook: Schema.String,
}) {}

/** The server is no development or preview server. */
export class Unavailable extends Schema.TaggedError<
  Unavailable,
  { readonly brand: unique symbol }
>()("Dev.Unavailable", {}) {}

/** The request carries no valid session. */
export class SignedOut extends Schema.TaggedError<SignedOut, { readonly brand: unique symbol }>()(
  "Dev.SignedOut",
  {},
) {}

export class UnknownSchool extends Schema.TaggedError<
  UnknownSchool,
  { readonly brand: unique symbol }
>()("Dev.UnknownSchool", { school: Schema.String }) {}

export const Rpcs = RpcGroup.make(
  /** A new school on each call, so runs never share one. */
  Rpc.make("Dev.createSchool", {
    success: School,
    error: Schema.Union([Unavailable, SignedOut]),
  }),
  /**
   * Admits the caller to the school with a notebook there, choosing every course the school
   * offers today to grade level 11. A second call answers the same notebook and changes nothing.
   */
  Rpc.make("Dev.admit", {
    payload: { school: Schema.String },
    success: Admission,
    error: Schema.Union([Unavailable, SignedOut, UnknownSchool]),
  }),
);
