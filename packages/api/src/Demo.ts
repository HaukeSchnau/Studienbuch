import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Schema from "effect/Schema";

// The demo school's students, whom development servers and previews let anyone sign in as, and the
// root key the server derives for them (ADR 0027). Every server has the group. Only development and
// preview servers sign anyone in, and every server gives a demo account its own root key.

export * as Demo from "./Demo.ts";

/** The students the seed creates in the demo school. */
export const Persona = Schema.Literals(["lena", "tom"]);

export type Persona = typeof Persona.Type;

/**
 * A new session of the persona's account, as the signed bearer token a sign-in returns, and the
 * account's root key of generation 0, which a device keeps as a first device keeps its own.
 */
export class Session extends Schema.Class<Session, { readonly brand: unique symbol }>(
  "Demo.Session",
)({
  account: Schema.String,
  token: Schema.String,
  rootKey: Schema.Uint8Array,
}) {}

/** The calling demo account's root key of generation 0. */
export class RootKey extends Schema.Class<RootKey, { readonly brand: unique symbol }>(
  "Demo.RootKey",
)({
  rootKey: Schema.Uint8Array,
}) {}

/** The server is no development or preview server. */
export class Unavailable extends Schema.TaggedError<
  Unavailable,
  { readonly brand: unique symbol }
>()("Demo.Unavailable", {}) {}

/** The server never seeded the demo school, so the persona has no account. */
export class NotSeeded extends Schema.TaggedError<NotSeeded, { readonly brand: unique symbol }>()(
  "Demo.NotSeeded",
  { persona: Persona },
) {}

/** The request carries no valid session. */
export class SignedOut extends Schema.TaggedError<SignedOut, { readonly brand: unique symbol }>()(
  "Demo.SignedOut",
  {},
) {}

/** The caller isn't a demo account, so the server holds no key for it. */
export class NotDemo extends Schema.TaggedError<NotDemo, { readonly brand: unique symbol }>()(
  "Demo.NotDemo",
  {},
) {}

export const Rpcs = RpcGroup.make(
  Rpc.make("Demo.signIn", {
    payload: { persona: Persona },
    success: Session,
    error: Schema.Union([Unavailable, NotSeeded]),
  }),
  /** For the store review account on beta, which signs in with its password. */
  Rpc.make("Demo.rootKey", {
    success: RootKey,
    error: Schema.Union([SignedOut, NotDemo]),
  }),
);
