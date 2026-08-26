import { AccessApi } from "@stu/api";
import { Organization } from "@stu/core";
import * as Schema from "effect/Schema";
import { RpcClientError } from "effect/unstable/rpc";

const AccessFailure = Schema.Union([
  Organization.CodeUnavailable,
  Organization.ReservationUnavailable,
  Organization.EmailNotVerified,
  Organization.AccessAlreadyExists,
  Organization.ProfileUnavailable,
  AccessApi.InvalidOrigin,
  AccessApi.AuthenticationRequired,
  AccessApi.RateLimited,
  RpcClientError.RpcClientError,
]);

export type AccessFailure = typeof AccessFailure.Type;
export const isAccessFailure = Schema.is(AccessFailure);

/** German for every typed access failure, with a safe fallback for defects and unknown errors. */
export const accessMessage = (failure: AccessFailure | Error | undefined): string => {
  if (failure === undefined || !isAccessFailure(failure)) {
    return "Da ist bei uns etwas schiefgegangen. Versuche es gleich noch einmal.";
  }

  switch (failure._tag) {
    case "SchoolAccess.CodeUnavailable":
      // Do not reveal whether a code is unknown, spent, or held by another reservation.
      return "Dieser Zugangscode passt nicht. Er ist entweder unbekannt, schon eingelöst oder gerade in Benutzung.";
    case "SchoolAccess.ReservationUnavailable":
      return "Dieser Zugangscode ist nicht mehr vorgemerkt. Gib ihn noch einmal ein, um weiterzumachen.";
    case "SchoolAccess.EmailNotVerified":
      return "Bestätige zuerst deine E-Mail-Adresse. Den Link haben wir dir geschickt.";
    case "SchoolAccess.AccessAlreadyExists":
      return "Diesen Schulzugang hast du schon. Du findest ihn in deinem Konto.";
    case "SchoolAccess.ProfileUnavailable":
      return "Diese Angaben passen nicht zu deinem Schulzugang. Lade die Seite neu und versuche es erneut.";
    case "AccessApi.InvalidOrigin":
      return "Diese Anfrage kam nicht von Studienbuch. Lade die Seite neu und versuche es erneut.";
    case "AccessApi.AuthenticationRequired":
      return "Melde dich an, um hier weiterzumachen.";
    case "AccessApi.RateLimited":
      return "Das waren zu viele Versuche hintereinander. Warte einen Moment und versuche es dann noch einmal.";
    case "RpcClientError":
      return "Da ist bei uns etwas schiefgegangen. Versuche es gleich noch einmal.";
  }
};

/** German for the Better Auth failures a visitor can cause. */
const betterAuthMessages = new Map([
  ["PASSWORD_TOO_SHORT", "Das Passwort ist zu kurz. Nimm mindestens acht Zeichen."],
  ["PASSWORD_TOO_LONG", "Das Passwort ist zu lang."],
  ["INVALID_EMAIL", "Diese E-Mail-Adresse sieht nicht richtig aus."],
  [
    "SCHOOL_ACCESS_RESERVATION_REQUIRED",
    "Dieser Zugangscode ist nicht mehr vorgemerkt oder wurde zu oft verwendet. Gib ihn noch einmal ein.",
  ],
]);

/** Maps the stable Better Auth error code and lets each ceremony choose its fallback wording. */
export const betterAuthMessage = (
  error: { readonly code?: string | undefined; readonly status: number } | null | undefined,
  fallback: string,
) => (error?.code === undefined ? fallback : (betterAuthMessages.get(error.code) ?? fallback));
