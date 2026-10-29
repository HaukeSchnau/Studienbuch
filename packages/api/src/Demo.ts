import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Schema from "effect/Schema";

// The demo school's students, whom development servers and previews let anyone sign in as. Every
// server has the group, and only development and preview servers answer (ADR 0027).

export * as Demo from "./Demo.ts";

/** The students the seed creates in the demo school. */
export const Persona = Schema.Literals(["lena", "tom"]);

export type Persona = typeof Persona.Type;

/** A new session of the persona's account, as the signed bearer token a sign-in returns. */
export class Session extends Schema.Class<Session, { readonly brand: unique symbol }>(
  "Demo.Session",
)({
  account: Schema.String,
  token: Schema.String,
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

export const Rpcs = RpcGroup.make(
  Rpc.make("Demo.signIn", {
    payload: { persona: Persona },
    success: Session,
    error: Schema.Union([Unavailable, NotSeeded]),
  }),
);
