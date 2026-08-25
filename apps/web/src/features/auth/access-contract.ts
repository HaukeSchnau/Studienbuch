import * as Schema from "effect/Schema";

const shortText = Schema.String.check(Schema.isTrimmed(), Schema.isMaxLength(160));

export const ReserveAccessInput = Schema.Struct({ code: Schema.String });
export const ReservationInput = Schema.Struct({ token: Schema.String });
export const ProfileInput = Schema.Struct({
  schoolAccessId: Schema.String,
  displayName: shortText,
  cohort: Schema.optional(shortText),
  className: Schema.optional(shortText),
});

export const decodeReserveAccessInput = Schema.decodeUnknownExit(ReserveAccessInput);
export const decodeReservationInput = Schema.decodeUnknownExit(ReservationInput);
export const decodeProfileInput = Schema.decodeUnknownExit(ProfileInput);

export const accessRoutes = {
  reserve: "/api/access/reserve",
  reservation: "/api/access/reservation",
  complete: "/api/access/complete",
  profile: "/api/access/profile",
  me: "/api/access/me",
} as const;
