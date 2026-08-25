import { Organization } from "@stu/core/organization";
import * as Schema from "effect/Schema";

/**
 * Whitespace is trimmed by the client before it is sent, so the schema does not insist on it.
 * Rejecting a trailing space would turn an invisible difference into an unexplainable failure.
 */
const profileField = Schema.String.check(Schema.isMaxLength(Organization.profileFieldMaxLength));

export const ReserveAccessInput = Schema.Struct({ code: Schema.String });
export const ReservationInput = Schema.Struct({ token: Schema.String });
export const ProfileInput = Schema.Struct({
  schoolAccessId: Schema.String,
  displayName: profileField,
  cohort: Schema.optional(profileField),
  className: Schema.optional(profileField),
});

export const decodeReserveAccessInput = Schema.decodeUnknownExit(ReserveAccessInput);
export const decodeReservationInput = Schema.decodeUnknownExit(ReservationInput);
export const decodeProfileInput = Schema.decodeUnknownExit(ProfileInput);

/**
 * Every reason one of these routes can refuse.
 *
 * Named here, next to the request shapes, because the codes are as much a part of the contract as
 * the bodies are: the server picks one and the client turns it into a sentence, and neither can do
 * its half if the set is only written down in the handler that emits it.
 */
export const accessErrorCodes = {
  /** The code is unknown, expired, revoked, already redeemed, or reserved by someone else. */
  codeUnavailable: "code_unavailable",
  reservationUnavailable: "reservation_unavailable",
  emailVerificationRequired: "email_verification_required",
  accessAlreadyExists: "access_already_exists",
  profileUnavailable: "profile_unavailable",
  invalidRequest: "invalid_request",
  invalidOrigin: "invalid_origin",
  authenticationRequired: "authentication_required",
  rateLimited: "rate_limited",
  requestCancelled: "request_cancelled",
  internalError: "internal_error",
} as const;

export type AccessErrorCode = (typeof accessErrorCodes)[keyof typeof accessErrorCodes];

const AccessErrorCodeSchema = Schema.Literals(Object.values(accessErrorCodes));

/** The body every route sends when it refuses. Anything else is not a refusal this client wrote. */
export const decodeAccessFailure = Schema.decodeUnknownExit(
  Schema.Struct({ error: AccessErrorCodeSchema }),
);

const SchoolRef = Schema.Struct({ id: Schema.String, name: Schema.String });

/**
 * What each route answers with.
 *
 * Parsed rather than asserted. These shapes cross a process boundary, so the only way the client
 * can promise the types it hands to a component is to check them on the way in — and a response
 * that lost a field to a deployment skew then fails where it arrives instead of somewhere later.
 */
export const ReservationView = Schema.Struct({
  expiresAt: Schema.String,
  school: SchoolRef,
  kind: Organization.SchoolAccessKind,
});

export const ReservationCreated = Schema.Struct({
  ...ReservationView.fields,
  token: Schema.String,
});

export const SchoolAccessCreated = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.String,
  school: SchoolRef,
  kind: Organization.SchoolAccessKind,
});

export const SchoolAccessView = Schema.Struct({
  id: Schema.String,
  kind: Organization.SchoolAccessKind,
  createdAt: Schema.String,
  schoolId: Schema.String,
  schoolName: Schema.String,
  displayName: Schema.NullOr(Schema.String),
  cohort: Schema.NullOr(Schema.String),
  className: Schema.NullOr(Schema.String),
});

export const AccountView = Schema.Struct({
  user: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    email: Schema.NullOr(Schema.String),
    emailVerified: Schema.Boolean,
  }),
  operator: Schema.Boolean,
  accesses: Schema.Array(SchoolAccessView),
});

export const ProfileSaved = Schema.Struct({
  profile: Schema.Struct({
    displayName: Schema.String,
    cohort: Schema.NullOr(Schema.String),
    className: Schema.NullOr(Schema.String),
  }),
});

export const accessRoutes = {
  reserve: "/api/access/reserve",
  reservation: "/api/access/reservation",
  complete: "/api/access/complete",
  profile: "/api/access/profile",
  me: "/api/access/me",
} as const;
