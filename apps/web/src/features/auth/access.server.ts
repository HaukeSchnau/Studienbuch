import { Operator, SchoolAccess } from "@stu/server";
import type { Database } from "@stu/server";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import {
  accessErrorCodes,
  decodeProfileInput,
  decodeReservationInput,
  decodeReserveAccessInput,
} from "./access-contract.ts";
import { getAuth } from "#/infra/auth/better-auth.ts";
import {
  forwardedClientPrincipal,
  makeFixedWindowLimiter,
  rateLimitedResponse,
} from "#/infra/http/rate-limit.server.ts";
import { exitFailureResponse, jsonResponse, readJsonBody } from "#/infra/http/response.server.ts";
import { runRouteEffect } from "#/infra/runtime/request.server.ts";

const invalidBody = () => jsonResponse({ error: accessErrorCodes.invalidRequest }, 422);

const sameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
};

/**
 * How often one client may attempt an enrollment step.
 *
 * Not an entropy measure: an access code carries 80 bits, so guessing one is out of reach whatever
 * the rate. This bounds the noise a single client can make — reservation churn that takes codes out
 * of circulation, and the database work behind every attempt — on routes Better Auth's own limiter
 * does not see, because they are ours rather than its.
 */
const attemptsPerMinute = 20;
const limit = makeFixedWindowLimiter({ limit: attemptsPerMinute, windowMillis: 60_000 });

/**
 * Guards the mutating routes: same origin, then within rate.
 *
 * Keyed by forwarded address rather than by session, because the pages that call these routes are
 * reached before there is a session to key on.
 */
const rejectMutation = (request: Request) => {
  if (!sameOrigin(request)) return jsonResponse({ error: accessErrorCodes.invalidOrigin }, 403);
  const decision = limit(forwardedClientPrincipal(request));
  return decision.allowed ? undefined : rateLimitedResponse(decision);
};

const sessionUser = async (request: Request) =>
  (await (await getAuth()).api.getSession({ headers: request.headers }))?.user;

const unauthenticated = () => jsonResponse({ error: accessErrorCodes.authenticationRequired }, 401);

const runAccessRoute = async (
  request: Request,
  route: string,
  effect: Effect.Effect<Response, object, Database.Service>,
) => {
  const exit = await runRouteEffect(effect, { request, route });
  return Exit.isSuccess(exit)
    ? exit.value
    : (exitFailureResponse(exit) ?? jsonResponse({ error: accessErrorCodes.internalError }, 500));
};

export const handleReserve = async (request: Request) => {
  const rejected = rejectMutation(request);
  if (rejected !== undefined) return rejected;
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
        Effect.succeed(jsonResponse({ error: accessErrorCodes.codeUnavailable }, 404)),
      ),
    ),
  );
};

export const handleReservation = async (request: Request) => {
  const rejected = rejectMutation(request);
  if (rejected !== undefined) return rejected;
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
        Effect.succeed(jsonResponse({ error: accessErrorCodes.reservationUnavailable }, 404)),
      ),
    ),
  );
};

export const handleComplete = async (request: Request) => {
  const rejected = rejectMutation(request);
  if (rejected !== undefined) return rejected;
  const user = await sessionUser(request);
  if (user === undefined) return unauthenticated();
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
          Effect.succeed(jsonResponse({ error: accessErrorCodes.emailVerificationRequired }, 403)),
        "SchoolAccess.ReservationUnavailable": () =>
          Effect.succeed(jsonResponse({ error: accessErrorCodes.reservationUnavailable }, 404)),
        "SchoolAccess.AccessAlreadyExists": () =>
          Effect.succeed(jsonResponse({ error: accessErrorCodes.accessAlreadyExists }, 409)),
      }),
    ),
  );
};

export const handleProfile = async (request: Request) => {
  const rejected = rejectMutation(request);
  if (rejected !== undefined) return rejected;
  const user = await sessionUser(request);
  if (user === undefined) return unauthenticated();
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
        Effect.succeed(jsonResponse({ error: accessErrorCodes.profileUnavailable }, 404)),
      ),
    ),
  );
};

/**
 * No origin check, unlike the four routes above, and deliberately so: this reads rather than
 * writes, and a cross-origin page cannot read a response it has no CORS permission for. Requiring
 * an `Origin` header here would only break the credentialed same-origin GET the app makes.
 */
export const handleMe = async (request: Request) => {
  const user = await sessionUser(request);
  if (user === undefined) return unauthenticated();
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
