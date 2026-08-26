import { AccessApi } from "@stu/api";
import { Organization } from "@stu/core";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { AtomRpc } from "effect/unstable/reactivity";
import { RpcClient } from "effect/unstable/rpc";
import { browserRpcProtocol } from "#/infra/rpc/protocol.ts";

export type ReservationView = AccessApi.ReservationView;
export type SchoolAccessView = AccessApi.SchoolAccessView;
export type AccountView = AccessApi.AccountView;

export const accessErrorCodes = {
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

export interface ApiFailure {
  readonly _tag: "ApiFailure";
  readonly code: AccessErrorCode;
  readonly status: number;
}

export type ApiResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: ApiFailure };

const failureCodes = new Map<string, AccessErrorCode>([
  ["SchoolAccess.CodeUnavailable", accessErrorCodes.codeUnavailable],
  ["SchoolAccess.ReservationUnavailable", accessErrorCodes.reservationUnavailable],
  ["SchoolAccess.EmailNotVerified", accessErrorCodes.emailVerificationRequired],
  ["SchoolAccess.AccessAlreadyExists", accessErrorCodes.accessAlreadyExists],
  ["SchoolAccess.ProfileUnavailable", accessErrorCodes.profileUnavailable],
  ["AccessApi.InvalidOrigin", accessErrorCodes.invalidOrigin],
  ["AccessApi.AuthenticationRequired", accessErrorCodes.authenticationRequired],
  ["AccessApi.RateLimited", accessErrorCodes.rateLimited],
]);

const failed = (code: AccessErrorCode, status = 0): ApiResult<never> => ({
  ok: false,
  error: { _tag: "ApiFailure", code, status },
});

const makeClient = RpcClient.make(AccessApi.Rpcs);
type Client = Effect.Success<typeof makeClient>;

const withClient = <A, E>(use: (client: Client) => Effect.Effect<A, E>) =>
  Effect.scoped(makeClient.pipe(Effect.flatMap(use), Effect.provide(browserRpcProtocol)));

const run = async <A, E extends { readonly _tag: string }>(
  effect: Effect.Effect<A, E>,
): Promise<ApiResult<A>> => {
  try {
    const result = await Effect.runPromise(effect.pipe(Effect.result));
    if (Result.isSuccess(result)) return { ok: true, value: result.success };
    return failed(failureCodes.get(result.failure._tag) ?? accessErrorCodes.internalError);
  } catch {
    return failed(accessErrorCodes.internalError);
  }
};

export const reserveAccess = (code: string) =>
  run(withClient((client) => client["Access.Reserve"]({ code })));

export const inspectReservation = (token: string) =>
  run(
    Schema.decodeEffect(Organization.SchoolAccessReservationToken)(token).pipe(
      Effect.flatMap((reservationToken) =>
        withClient((client) => client["Access.InspectReservation"]({ token: reservationToken })),
      ),
    ),
  );

export const completeReservation = (token: string) =>
  run(
    Schema.decodeEffect(Organization.SchoolAccessReservationToken)(token).pipe(
      Effect.flatMap((reservationToken) =>
        withClient((client) => client["Access.CompleteReservation"]({ token: reservationToken })),
      ),
    ),
  );

export const saveProfile = (input: {
  readonly schoolAccessId: string;
  readonly displayName: string;
  readonly cohort: string;
  readonly className: string;
}) =>
  run(
    Schema.decodeEffect(Organization.NotebookProfileInput)({
      ...input,
      cohort: input.cohort,
      className: input.className,
    }).pipe(
      Effect.flatMap((profile) => withClient((client) => client["Access.SaveProfile"](profile))),
    ),
  );

export const AccessAtoms = AtomRpc.Service()("@stu/web/auth/AccessAtoms", {
  group: AccessApi.Rpcs,
  protocol: browserRpcProtocol,
});

export const accountAtom = AccessAtoms.query("Access.GetAccount", undefined, {
  serializationKey: "current-account",
  timeToLive: "30 seconds",
});
