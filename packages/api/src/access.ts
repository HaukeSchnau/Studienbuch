import { Organization } from "@stu/core";
import * as Context from "effect/Context";
import * as Schema from "effect/Schema";
import { Rpc, RpcGroup, RpcMiddleware } from "effect/unstable/rpc";

export const rpcPath = "/api/rpc";

export const SchoolReference = Schema.Struct({
  id: Organization.SchoolId,
  name: Schema.String,
});

export const ReservationView = Schema.Struct({
  expiresAt: Schema.DateTimeUtcFromString,
  school: SchoolReference,
  kind: Organization.SchoolAccessKind,
});
export type ReservationView = typeof ReservationView.Type;

export const ReservationCreated = Schema.Struct({
  ...ReservationView.fields,
  token: Organization.SchoolAccessReservationToken,
});
export type ReservationCreated = typeof ReservationCreated.Type;

export const SchoolAccessCreated = Schema.Struct({
  id: Organization.SchoolAccessId,
  createdAt: Schema.DateTimeUtcFromString,
  school: SchoolReference,
  kind: Organization.SchoolAccessKind,
});
export type SchoolAccessCreated = typeof SchoolAccessCreated.Type;

export const SchoolAccessView = Schema.Struct({
  id: Organization.SchoolAccessId,
  kind: Organization.SchoolAccessKind,
  createdAt: Schema.DateTimeUtcFromString,
  schoolId: Organization.SchoolId,
  schoolName: Schema.String,
  displayName: Schema.NullOr(Schema.String),
  cohort: Schema.NullOr(Schema.String),
  className: Schema.NullOr(Schema.String),
});
export type SchoolAccessView = typeof SchoolAccessView.Type;

export const AccountView = Schema.Struct({
  user: Schema.Struct({
    id: Organization.AccountId,
    name: Schema.String,
    email: Schema.NullOr(Schema.String),
    emailVerified: Schema.Boolean,
  }),
  operator: Schema.Boolean,
  accesses: Schema.Array(SchoolAccessView),
});
export type AccountView = typeof AccountView.Type;

export const ProfileSaved = Schema.Struct({
  profile: Schema.Struct({
    displayName: Organization.RequiredProfileField,
    cohort: Schema.NullOr(Organization.OptionalProfileField),
    className: Schema.NullOr(Organization.OptionalProfileField),
  }),
});
export type ProfileSaved = typeof ProfileSaved.Type;

export class InvalidOrigin extends Schema.TaggedError<InvalidOrigin>()(
  "AccessApi.InvalidOrigin",
  {},
) {}

export class RateLimited extends Schema.TaggedError<RateLimited>()("AccessApi.RateLimited", {
  retryAfterSeconds: Schema.Finite,
}) {}

export class AuthenticationRequired extends Schema.TaggedError<AuthenticationRequired>()(
  "AccessApi.AuthenticationRequired",
  {},
) {}

export class AuthenticatedUser extends Context.Service<
  AuthenticatedUser,
  {
    readonly id: Organization.AccountId;
    readonly name: string;
    readonly email: string;
    readonly emailVerified: boolean;
  }
>()("@stu/api/access/AuthenticatedUser") {}

export class EnrollmentAdmission extends RpcMiddleware.Service<EnrollmentAdmission>()(
  "@stu/api/access/EnrollmentAdmission",
  { error: Schema.Union([InvalidOrigin, RateLimited]) },
) {}

export class Authenticated extends RpcMiddleware.Service<
  Authenticated,
  { provides: AuthenticatedUser }
>()("@stu/api/access/Authenticated", { error: AuthenticationRequired }) {}

export const Reserve = Rpc.make("Access.Reserve", {
  payload: { code: Schema.String },
  success: ReservationCreated,
  error: Organization.CodeUnavailable,
}).middleware(EnrollmentAdmission);

export const InspectReservation = Rpc.make("Access.InspectReservation", {
  payload: { token: Organization.SchoolAccessReservationToken },
  success: ReservationView,
  error: Organization.ReservationUnavailable,
}).middleware(EnrollmentAdmission);

export const CompleteReservation = Rpc.make("Access.CompleteReservation", {
  payload: { token: Organization.SchoolAccessReservationToken },
  success: SchoolAccessCreated,
  error: Schema.Union([
    Organization.EmailNotVerified,
    Organization.ReservationUnavailable,
    Organization.AccessAlreadyExists,
  ]),
})
  .middleware(EnrollmentAdmission)
  .middleware(Authenticated);

export const SaveProfile = Rpc.make("Access.SaveProfile", {
  payload: Organization.NotebookProfileInput,
  success: ProfileSaved,
  error: Organization.ProfileUnavailable,
})
  .middleware(EnrollmentAdmission)
  .middleware(Authenticated);

export const GetAccount = Rpc.make("Access.GetAccount", {
  success: AccountView,
}).middleware(Authenticated);

export const Rpcs = RpcGroup.make(
  Reserve,
  InspectReservation,
  CompleteReservation,
  SaveProfile,
  GetAccount,
);
