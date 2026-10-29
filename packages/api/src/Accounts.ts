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
