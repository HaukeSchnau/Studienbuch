import { AccessApi } from "@stu/api";
import { Organization } from "@stu/core";
import { Auth, Operator, SchoolAccess } from "@stu/server";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpEffect from "effect/unstable/http/HttpEffect";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import {
  EnrollmentRateLimiter,
  forwardedPrincipalFromHeaders,
} from "#/infra/http/rate-limit.server.ts";

const sameOrigin = (headers: Readonly<Record<string, string>>) => {
  const origin = headers.origin;
  const host = headers["x-forwarded-host"] ?? headers.host;
  if (origin === undefined || host === undefined) return Effect.succeed(false);
  return Effect.try({
    try: () => new URL(origin).host === host,
    catch: () => false,
  });
};

const admissionLayer = Layer.succeed(
  AccessApi.EnrollmentAdmission,
  AccessApi.EnrollmentAdmission.of((effect, { headers }) =>
    Effect.gen(function* () {
      if (!(yield* sameOrigin(headers))) return yield* AccessApi.InvalidOrigin.make();
      const limiter = yield* EnrollmentRateLimiter;
      const decision = yield* limiter.check(forwardedPrincipalFromHeaders(headers));
      if (!decision.allowed) {
        return yield* AccessApi.RateLimited.make({
          retryAfterSeconds: decision.retryAfterSeconds,
        });
      }
      return yield* effect;
    }),
  ),
);

const authenticatedLayer = Layer.succeed(
  AccessApi.Authenticated,
  AccessApi.Authenticated.of((effect, { headers }) =>
    Effect.gen(function* () {
      const auth = yield* Auth.Service;
      const session = yield* Effect.tryPromise({
        try: () => auth.api.getSession({ headers: new globalThis.Headers(headers) }),
        catch: () => AccessApi.AuthenticationRequired.make(),
      });
      if (session?.user === undefined) return yield* AccessApi.AuthenticationRequired.make();
      return yield* effect.pipe(
        Effect.provideService(
          AccessApi.AuthenticatedUser,
          AccessApi.AuthenticatedUser.of({
            id: Organization.AccountId.make(session.user.id),
            name: session.user.name,
            email: session.user.email,
            emailVerified: session.user.emailVerified,
          }),
        ),
      );
    }),
  ),
);

const school = (value: { readonly id: string; readonly name: string }) => ({
  id: Organization.SchoolId.make(value.id),
  name: value.name,
});

const handlers = AccessApi.Rpcs.toLayer({
  "Access.Reserve": ({ code }) =>
    SchoolAccess.reserve(code).pipe(
      Effect.map((reservation) => ({
        token: Organization.SchoolAccessReservationToken.make(reservation.token),
        expiresAt: DateTime.fromDateUnsafe(reservation.expiresAt),
        school: school(reservation.school),
        kind: reservation.kind,
      })),
    ),
  "Access.InspectReservation": ({ token }) =>
    SchoolAccess.inspectReservation(token).pipe(
      Effect.map((reservation) => ({
        expiresAt: DateTime.fromDateUnsafe(reservation.expiresAt),
        school: school(reservation.school),
        kind: reservation.kind,
      })),
    ),
  "Access.CompleteReservation": ({ token }) =>
    Effect.gen(function* () {
      const user = yield* AccessApi.AuthenticatedUser;
      const access = yield* SchoolAccess.completeReservation(user.id, token);
      return {
        id: Organization.SchoolAccessId.make(access.id),
        createdAt: DateTime.fromDateUnsafe(access.createdAt),
        school: school(access.school),
        kind: access.kind,
      };
    }),
  "Access.SaveProfile": (input) =>
    Effect.gen(function* () {
      const user = yield* AccessApi.AuthenticatedUser;
      const profile = yield* SchoolAccess.saveProfile(user.id, input);
      return {
        profile: {
          displayName: Organization.RequiredProfileField.make(profile.displayName),
          cohort:
            profile.cohort === undefined
              ? null
              : Organization.OptionalProfileField.make(profile.cohort),
          className:
            profile.className === undefined
              ? null
              : Organization.OptionalProfileField.make(profile.className),
        },
      };
    }),
  "Access.GetAccount": () =>
    Effect.gen(function* () {
      const user = yield* AccessApi.AuthenticatedUser;
      const { accesses, operator } = yield* Effect.all({
        accesses: SchoolAccess.listForUser(user.id),
        operator: Operator.isActive(user.id),
      });
      return {
        user: {
          ...user,
          email: user.email.endsWith("@accounts.invalid") ? null : user.email,
        },
        operator,
        accesses: accesses.map((access) => ({
          id: Organization.SchoolAccessId.make(access.id),
          kind: access.kind,
          createdAt: DateTime.fromDateUnsafe(access.createdAt),
          schoolId: Organization.SchoolId.make(access.schoolId),
          schoolName: access.schoolName,
          displayName: access.displayName,
          cohort: access.cohort,
          className: access.className,
        })),
      };
    }),
});

export class AccessRpcEndpoint extends Context.Service<
  AccessRpcEndpoint,
  (request: Request) => Promise<Response>
>()("@stu/web/auth/AccessRpcEndpoint") {
  static readonly layer = Layer.scoped(
    AccessRpcEndpoint,
    Effect.gen(function* () {
      const httpEffect = yield* RpcServer.toHttpEffect(AccessApi.Rpcs).pipe(
        Effect.provide([handlers, admissionLayer, authenticatedLayer, RpcSerialization.layerJson]),
      );
      return HttpEffect.toWebHandler(httpEffect);
    }),
  );
}
