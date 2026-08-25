import { accessRoutes } from "./access-contract.ts";

export interface ReservationView {
  readonly expiresAt: string;
  readonly school: { readonly id: string; readonly name: string };
  readonly kind: "Student" | "Teacher";
}

export interface ReservationCreated extends ReservationView {
  readonly token: string;
}

export interface SchoolAccessView {
  readonly id: string;
  readonly kind: "Student" | "Teacher";
  readonly createdAt: string;
  readonly schoolId: string;
  readonly schoolName: string;
  readonly displayName: string | null;
  readonly cohort: string | null;
  readonly className: string | null;
}

export interface AccountView {
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string | null;
    readonly emailVerified: boolean;
  };
  readonly operator: boolean;
  readonly accesses: ReadonlyArray<SchoolAccessView>;
}

export interface ApiFailure {
  readonly _tag: "ApiFailure";
  readonly code: string;
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

const request = async <ResponseBody>(
  url: string,
  init?: RequestInit,
): Promise<ApiResult<ResponseBody>> => {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers,
  });
  const body: ResponseBody & { readonly error?: string } = await response.json();
  if (!response.ok) {
    return {
      ok: false,
      error: {
        _tag: "ApiFailure",
        code: body.error ?? "request_failed",
        status: response.status,
      },
    };
  }
  return { ok: true, value: body };
};

const post = <ResponseBody>(url: string, body: JsonInput) =>
  request<ResponseBody>(url, { method: "POST", body: JSON.stringify(body) });

export const reserveAccess = (code: string) =>
  post<ReservationCreated>(accessRoutes.reserve, { code });

export const inspectReservation = (token: string) =>
  post<ReservationView>(accessRoutes.reservation, { token });

export const completeReservation = (token: string) =>
  post<{ readonly id: string } & ReservationView>(accessRoutes.complete, { token });

export const saveProfile = (input: {
  readonly schoolAccessId: string;
  readonly displayName: string;
  readonly cohort?: string;
  readonly className?: string;
}) => post<{ readonly profile: object }>(accessRoutes.profile, input);

export const loadAccount = () => request<AccountView>(accessRoutes.me);
