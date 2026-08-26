import { AccessApi, Rpcs } from "@stu/api";
import { Organization } from "@stu/core";
import { AccessRpcHandlers, Auth, MarketingRpcHandlers } from "@stu/server";
import * as Context from "effect/Context";
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
  if (origin === undefined) return Effect.succeed(headers["sec-fetch-site"] === undefined);
  if (host === undefined) return Effect.succeed(false);
  return Effect.try(() => new URL(origin).host === host).pipe(Effect.orElseSucceed(() => false));
};

const admissionLayer = Layer.effect(
  AccessApi.EnrollmentAdmission,
  Effect.gen(function* () {
    const limiter = yield* EnrollmentRateLimiter;
    return AccessApi.EnrollmentAdmission.of((effect, { headers }) =>
      Effect.gen(function* () {
        if (!(yield* sameOrigin(headers))) return yield* AccessApi.InvalidOrigin.make();
        const decision = yield* limiter.check(forwardedPrincipalFromHeaders(headers));
        if (!decision.allowed) {
          return yield* AccessApi.RateLimited.make({
            retryAfterSeconds: decision.retryAfterSeconds,
          });
        }
        return yield* effect;
      }),
    );
  }),
);

const authenticatedLayer = Layer.effect(
  AccessApi.Authenticated,
  Effect.gen(function* () {
    const auth = yield* Auth.Service;
    return AccessApi.Authenticated.of((effect, { headers }) =>
      Effect.gen(function* () {
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
    );
  }),
);

export class ApplicationRpcEndpoint extends Context.Service<
  ApplicationRpcEndpoint,
  (request: Request) => Promise<Response>
>()("@stu/web/infra/rpc/endpoint.server/ApplicationRpcEndpoint") {
  static readonly layer = Layer.effect(
    ApplicationRpcEndpoint,
    Effect.gen(function* () {
      const httpEffect = yield* RpcServer.toHttpEffect(Rpcs).pipe(
        Effect.provide([
          AccessRpcHandlers,
          MarketingRpcHandlers,
          admissionLayer,
          authenticatedLayer,
          RpcSerialization.layerJson,
        ]),
      );
      return HttpEffect.toWebHandler(httpEffect);
    }),
  );
}
