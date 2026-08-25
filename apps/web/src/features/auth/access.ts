import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import {
  AccountView as AccountViewSchema,
  ProfileSaved,
  ReservationCreated,
  ReservationView as ReservationViewSchema,
  SchoolAccessCreated,
  accessErrorCodes,
  accessRoutes,
  decodeAccessFailure,
  type AccessErrorCode,
  type SchoolAccessView as SchoolAccessViewSchema,
} from "./access-contract.ts";

export type ReservationView = typeof ReservationViewSchema.Type;
export type SchoolAccessView = typeof SchoolAccessViewSchema.Type;
export type AccountView = typeof AccountViewSchema.Type;

export interface ApiFailure {
  readonly _tag: "ApiFailure";
  readonly code: AccessErrorCode;
  readonly status: number;
}

export type ApiResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: ApiFailure };

type JsonInput =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<JsonInput>
  | {
      readonly [key: string]: JsonInput | undefined;
    };

const failed = (code: AccessErrorCode, status: number) => ({
  ok: false as const,
  error: { _tag: "ApiFailure" as const, code, status },
});

/**
 * One of the access routes, as a result rather than as an exception.
 *
 * Nothing here throws. A route that is down answers with an HTML error page from a proxy, and a
 * caller that has to wrap every request in `try` to survive that will eventually forget one — so
 * the network failing, the body not being JSON, and the body not being what was promised all
 * arrive the same way as a refusal the server meant to send.
 */
const request = async <Response extends Schema.ConstraintDecoder<unknown>>(
  response: Response,
  url: string,
  init?: RequestInit,
): Promise<ApiResult<Response["Type"]>> => {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined) headers.set("content-type", "application/json");
  const received = await fetch(url, { credentials: "same-origin", ...init, headers }).catch(
    () => undefined,
  );
  if (received === undefined) return failed(accessErrorCodes.internalError, 0);

  const body: unknown = await received.json().catch(() => undefined);
  if (!received.ok) {
    const refusal = decodeAccessFailure(body);
    return failed(
      Exit.isSuccess(refusal) ? refusal.value.error : accessErrorCodes.internalError,
      received.status,
    );
  }

  const decoded = Schema.decodeUnknownExit(response)(body);
  return Exit.isSuccess(decoded)
    ? { ok: true, value: decoded.value }
    : failed(accessErrorCodes.internalError, received.status);
};

const post = <Response extends Schema.ConstraintDecoder<unknown>>(
  response: Response,
  url: string,
  body: JsonInput,
) => request(response, url, { method: "POST", body: JSON.stringify(body) });

export const reserveAccess = (code: string) =>
  post(ReservationCreated, accessRoutes.reserve, { code });

export const inspectReservation = (token: string) =>
  post(ReservationViewSchema, accessRoutes.reservation, { token });

export const completeReservation = (token: string) =>
  post(SchoolAccessCreated, accessRoutes.complete, { token });

/** An optional field the user left blank is absent rather than empty. */
const trimmedOrAbsent = (value: string) => {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

/**
 * Trimming happens here rather than in the schema so that a trailing space is corrected instead of
 * refused: the difference is invisible on screen, so an error about it could not be acted on.
 */
export const saveProfile = (input: {
  readonly schoolAccessId: string;
  readonly displayName: string;
  readonly cohort: string;
  readonly className: string;
}) =>
  post(ProfileSaved, accessRoutes.profile, {
    schoolAccessId: input.schoolAccessId,
    displayName: input.displayName.trim(),
    cohort: trimmedOrAbsent(input.cohort),
    className: trimmedOrAbsent(input.className),
  });

export const loadAccount = () => request(AccountViewSchema, accessRoutes.me);
