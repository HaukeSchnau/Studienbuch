import { Operator, SchoolAccess } from "@stu/server";
import type { Database } from "@stu/server";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import {
  decodeProfileInput,
  decodeReservationInput,
  decodeReserveAccessInput,
} from "./access-contract.ts";
import { getAuth } from "#/infra/auth/better-auth.ts";
import { exitFailureResponse, jsonResponse, readJsonBody } from "#/infra/http/response.server.ts";
import { runRouteEffect } from "#/infra/runtime/request.server.ts";

const invalidBody = () => jsonResponse({ error: "invalid_request" }, 422);

const sameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
};

const sessionUser = async (request: Request) =>
  (await (await getAuth()).api.getSession({ headers: request.headers }))?.user;

const runAccessRoute = async (
  request: Request,
  route: string,
  effect: Effect.Effect<Response, object, Database.Service>,
) => {
  const exit = await runRouteEffect(effect, { request, route });
  return Exit.isSuccess(exit)
    ? exit.value
    : (exitFailureResponse(exit) ?? jsonResponse({ error: "internal_error" }, 500));
};

export const handleReserve = async (request: Request) => {
  if (!sameOrigin(request)) return jsonResponse({ error: "invalid_origin" }, 403);
  const decoded = decodeReserveAccessInput(await readJsonBody(request, 1_024));
  if (Exit.isFailure(decoded)) return invalidBody();
  return runAccessRoute(
    request,
    "/api/access/reserve",
    SchoolAccess.reserve(decoded.value.code).pipe(
      Effect.map((reservation) =>
        jsonResponse({
          token: reservation.token,
          expiresAt: reservation.expiresAt.toISOString(),
          school: reservation.school,
          kind: reservation.kind,
        }),
      ),
      Effect.catchTag("SchoolAccess.CodeUnavailable", () =>
        Effect.succeed(jsonResponse({ error: "code_unavailable" }, 404)),
      ),
    ),
  );
};

export const handleReservation = async (request: Request) => {
  if (!sameOrigin(request)) return jsonResponse({ error: "invalid_origin" }, 403);
  const decoded = decodeReservationInput(await readJsonBody(request, 1_024));
  if (Exit.isFailure(decoded)) return invalidBody();
  return runAccessRoute(
    request,
    "/api/access/reservation",
    SchoolAccess.inspectReservation(decoded.value.token).pipe(
      Effect.map((reservation) =>
        jsonResponse({
          expiresAt: reservation.expiresAt.toISOString(),
          school: reservation.school,
          kind: reservation.kind,
        }),
      ),
      Effect.catchTag("SchoolAccess.ReservationUnavailable", () =>
        Effect.succeed(jsonResponse({ error: "reservation_unavailable" }, 404)),
      ),
    ),
  );
};

export const handleComplete = async (request: Request) => {
  if (!sameOrigin(request)) return jsonResponse({ error: "invalid_origin" }, 403);
  const user = await sessionUser(request);
  if (user === undefined) return jsonResponse({ error: "authentication_required" }, 401);
  const decoded = decodeReservationInput(await readJsonBody(request, 1_024));
  if (Exit.isFailure(decoded)) return invalidBody();
  return runAccessRoute(
    request,
    "/api/access/complete",
    SchoolAccess.completeReservation(user.id, decoded.value.token).pipe(
      Effect.map((access) =>
        jsonResponse({
          id: access.id,
          createdAt: access.createdAt.toISOString(),
          school: access.school,
          kind: access.kind,
        }),
      ),
      Effect.catchTags({
        "SchoolAccess.EmailNotVerified": () =>
          Effect.succeed(jsonResponse({ error: "email_verification_required" }, 403)),
        "SchoolAccess.ReservationUnavailable": () =>
          Effect.succeed(jsonResponse({ error: "reservation_unavailable" }, 404)),
        "SchoolAccess.AccessAlreadyExists": () =>
          Effect.succeed(jsonResponse({ error: "access_already_exists" }, 409)),
      }),
    ),
  );
};

export const handleProfile = async (request: Request) => {
  if (!sameOrigin(request)) return jsonResponse({ error: "invalid_origin" }, 403);
  const user = await sessionUser(request);
  if (user === undefined) return jsonResponse({ error: "authentication_required" }, 401);
  const decoded = decodeProfileInput(await readJsonBody(request, 2_048));
  if (Exit.isFailure(decoded)) return invalidBody();
  return runAccessRoute(
    request,
    "/api/access/profile",
    SchoolAccess.saveProfile(user.id, decoded.value).pipe(
      Effect.map((profile) =>
        jsonResponse({
          profile: {
            displayName: profile.displayName,
            cohort: profile.cohort ?? null,
            className: profile.className ?? null,
          },
        }),
      ),
      Effect.catchTag("SchoolAccess.ProfileUnavailable", () =>
        Effect.succeed(jsonResponse({ error: "profile_unavailable" }, 404)),
      ),
    ),
  );
};

export const handleMe = async (request: Request) => {
  const user = await sessionUser(request);
  if (user === undefined) return jsonResponse({ error: "authentication_required" }, 401);
  return runAccessRoute(
    request,
    "/api/access/me",
    Effect.all({
      accesses: SchoolAccess.listForUser(user.id),
      operator: Operator.isActive(user.id),
    }).pipe(
      Effect.map(({ accesses, operator }) =>
        jsonResponse({
          user: {
            id: user.id,
            name: user.name,
            email: user.email.endsWith("@accounts.invalid") ? null : user.email,
            emailVerified: user.emailVerified,
          },
          operator,
          accesses: accesses.map((access) => ({
            ...access,
            createdAt: access.createdAt.toISOString(),
          })),
        }),
      ),
    ),
  );
};
