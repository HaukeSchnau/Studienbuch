import * as Schema from "effect/Schema";

// Accounts over HTTP, which Better Auth answers on the server (ADR 0028). Devices call it with
// their bearer token and keep no cookies.

export * as Accounts from "./Accounts.ts";

/** Where sign-up, sign-in, email codes, passkeys and sessions live, on the server's origin. */
export const path = "/api/auth";

/**
 * Carries the passkey challenge from the options response to the verification request. The
 * server keeps it in a signed cookie for Better Auth, and devices keep no cookies.
 */
export const challengeHeader = "passkey-challenge";

/** The shortest password the server accepts, and the sign-up screen counts toward. */
export const minPasswordLength = 10;

/** How long the mailed code confirms an address. The mail and the app both say so. */
export const codeMinutes = 15;

/**
 * How long an address waits for its next code after one was requested. The server mails nothing
 * sooner, and the app counts down on its button.
 */
export const resendSeconds = 60;

/**
 * An email address as the app and the server check it before Better Auth does: one @, nothing
 * blank, a dot in the domain, and at most the 254 characters of an RFC 5321 path.
 */
export const Address = Schema.String.check(
  Schema.isMaxLength(254),
  Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u),
);

export const isAddress = Schema.is(Address);
