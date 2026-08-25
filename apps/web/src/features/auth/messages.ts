import type { ApiFailure } from "./access.ts";
import { accessErrorCodes, type AccessErrorCode } from "./access-contract.ts";

/**
 * German for every reason a request can be refused, in one place.
 *
 * The point is that the reasons already exist: the routes distinguish an expired reservation from
 * an unverified address from an access the account already holds, and a page that collapses them
 * into one sentence tells two thirds of its users something untrue. Keeping the wording here also
 * keeps it consistent between the four screens that can hit the same failure.
 *
 * `codeUnavailable` is the deliberate exception. Naming which of unknown, spent, or reserved a code
 * is would turn the form into an oracle for testing codes, so it stays vague on purpose.
 */
const accessMessages = {
  [accessErrorCodes.codeUnavailable]:
    "Dieser Zugangscode passt nicht. Er ist entweder unbekannt, schon eingelöst oder gerade in Benutzung.",
  [accessErrorCodes.reservationUnavailable]:
    "Dieser Zugangscode ist nicht mehr vorgemerkt. Gib ihn noch einmal ein, um weiterzumachen.",
  [accessErrorCodes.emailVerificationRequired]:
    "Bestätige zuerst deine E-Mail-Adresse. Den Link haben wir dir geschickt.",
  [accessErrorCodes.accessAlreadyExists]:
    "Diesen Schulzugang hast du schon. Du findest ihn in deinem Konto.",
  [accessErrorCodes.profileUnavailable]:
    "Diese Angaben passen nicht zu deinem Schulzugang. Lade die Seite neu und versuche es erneut.",
  [accessErrorCodes.invalidRequest]:
    "Diese Angaben konnten wir nicht lesen. Prüfe sie noch einmal.",
  [accessErrorCodes.invalidOrigin]:
    "Diese Anfrage kam nicht von Studienbuch. Lade die Seite neu und versuche es erneut.",
  [accessErrorCodes.authenticationRequired]: "Melde dich an, um hier weiterzumachen.",
  [accessErrorCodes.rateLimited]:
    "Das waren zu viele Versuche hintereinander. Warte einen Moment und versuche es dann noch einmal.",
  [accessErrorCodes.requestCancelled]: "Die Anfrage wurde abgebrochen. Versuche es noch einmal.",
  [accessErrorCodes.internalError]:
    "Da ist bei uns etwas schiefgegangen. Versuche es gleich noch einmal.",
} satisfies Record<AccessErrorCode, string>;

export const accessMessage = (failure: ApiFailure) => accessMessages[failure.code];

/**
 * German for the Better Auth failures a visitor can actually cause.
 *
 * Short by design. Better Auth answers a signup for an address it already knows with a success
 * rather than an error, so that signup cannot be used to test whether an address is registered —
 * there is no "already registered" message to write, and adding one would mean giving that up.
 */
const betterAuthMessages = new Map([
  ["PASSWORD_TOO_SHORT", "Das Passwort ist zu kurz. Nimm mindestens acht Zeichen."],
  ["PASSWORD_TOO_LONG", "Das Passwort ist zu lang."],
  ["INVALID_EMAIL", "Diese E-Mail-Adresse sieht nicht richtig aus."],
  [
    "SCHOOL_ACCESS_RESERVATION_REQUIRED",
    "Dieser Zugangscode ist nicht mehr vorgemerkt oder wurde zu oft verwendet. Gib ihn noch einmal ein.",
  ],
]);

/**
 * A Better Auth error turned into a sentence, falling back to the caller's own wording.
 *
 * The fallback is a parameter rather than a constant because these errors arrive from four
 * different ceremonies, and "that did not work" means something different in each.
 */
export const betterAuthMessage = (
  // Better Auth's error union carries `code` on some members only, so `status` is what every one of
  // them has in common and what makes this parameter assignable from all of them.
  error: { readonly code?: string | undefined; readonly status: number } | null | undefined,
  fallback: string,
) => (error?.code === undefined ? fallback : (betterAuthMessages.get(error.code) ?? fallback));
