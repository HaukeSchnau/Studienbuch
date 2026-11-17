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

/**
 * Whether an account's address is no address: one under the `.invalid` top-level domain, which no
 * mail reaches (RFC 6761). An account without an address carries one, because Better Auth needs
 * one per account.
 */
export const isPlaceholder = (email: string) => /\.invalid\.?$/iu.test(email);

/**
 * What a Notfallkarte signs in with: 32 bytes derived from the card (`RecoveryCode.login`), as
 * base64url without padding. The server keeps only its SHA-256.
 */
export const Login = Schema.String.check(Schema.isPattern(/^[\w-]{43}$/u));

/**
 * Creates an account without an address with a card's login, in `Login`'s `login` field, and the
 * access code's reservation in `Access.reservationHeader`. The same login again signs in to the
 * account it made, so a retry after a lost answer makes no second account.
 */
export const cardSignUpPath = "/sign-up/recovery-code";

/** Signs in to the account without an address that a card's `login` belongs to. */
export const cardSignInPath = "/sign-in/recovery-code";

/** The one answer to a login that belongs to no account. */
export const unknownCard = "UNKNOWN_RECOVERY_CODE";

/**
 * The answer to removing the last passkey of an account without an address that has no card
 * login, which would leave it without a way in.
 */
export const lastWayIn = "LAST_WAY_IN";
