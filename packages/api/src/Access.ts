import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Schema from "effect/Schema";

// Zugangscodes: a school hands out codes, and a sign-up starts with one. `Access.redeem` checks a
// code and holds one of its uses for a reservation, which the sign-up request carries in
// `reservationHeader`. Confirming the address admits the account to the code's school.

export * as Access from "./Access.ts";

/**
 * Crockford's alphabet, so `I`, `L`, `O` and `U` never need telling apart. 16 characters carry
 * 80 random bits, which nobody guesses within any rate limit.
 */
export const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const length = 16;

/** Upper case, without the hyphens and blanks that only format a code. */
export const normalize = (value: string) => value.toUpperCase().replaceAll(/[-\s]/gu, "");

/** What the alphabet leaves ambiguous, as the printed character. `U` stands for nothing. */
const confusable = new Map([
  ["I", "1"],
  ["L", "1"],
  ["O", "0"],
]);

/** Normalized, with each confusable letter as the digit it was printed as. The server's form. */
export const canonical = (value: string) =>
  Array.from(normalize(value), (character) => confusable.get(character) ?? character).join("");

/**
 * A code as someone types it into a field: `canonical`, and anything else outside the alphabet
 * dropped, so a stray keystroke costs one character. The result has no hyphens; `format` adds them.
 */
export const repair = (value: string) =>
  Array.from(canonical(value))
    .filter((character) => alphabet.includes(character))
    .slice(0, length)
    .join("");

/** Whether the value is a whole code, hyphens, case and confusable letters aside. */
export const isCode = (value: string) => {
  const code = canonical(value);

  return (
    code.length === length && Array.from(code).every((character) => alphabet.includes(character))
  );
};

/** In groups of four, as on paper: `XXXX-XXXX-XXXX-XXXX`. */
export const format = (value: string) =>
  canonical(value)
    .match(/.{1,4}/gu)
    ?.join("-") ?? "";

/** Who a code admits. Teachers and parents get their own kinds once their products exist. */
export const Kind = Schema.Literals(["student"]);

export type Kind = typeof Kind.Type;

/**
 * The header that carries a reservation to Better Auth's `/sign-up/email`. A header rather than
 * the body, so it never reaches a request log.
 */
export const reservationHeader = "access-reservation";

/**
 * Better Auth's error code for a sign-up without a usable reservation: none, or one that expired,
 * was spent or whose code ended. The answer is to enter the code again.
 */
export const reservationRefused = "ACCESS_RESERVATION_REQUIRED";

/** A held use of a code, for the sign-up that follows. */
export class Reservation extends Schema.Class<Reservation, { readonly brand: unique symbol }>(
  "Access.Reservation",
)({
  /** Goes to `/sign-up/email` in `reservationHeader`. */
  token: Schema.String,
  schoolName: Schema.String,
  kind: Kind,
  /** The sign-up's address must be confirmed before this. */
  expiresAt: Schema.DateTimeUtc,
}) {}

/**
 * No code like it can be used now: it is unknown, revoked, expired or used up. One error for all,
 * so a guess learns nothing.
 */
export class CodeUnavailable extends Schema.TaggedError<
  CodeUnavailable,
  { readonly brand: unique symbol }
>()("Access.CodeUnavailable", {}) {}

/** Too many attempts from this address, or at this code. */
export class RateLimited extends Schema.TaggedError<
  RateLimited,
  { readonly brand: unique symbol }
>()("Access.RateLimited", { retryAfterSeconds: Schema.Int }) {}

export const Rpcs = RpcGroup.make(
  Rpc.make("Access.redeem", {
    payload: { code: Schema.String },
    success: Reservation,
    error: Schema.Union([CodeUnavailable, RateLimited]),
  }),
);
