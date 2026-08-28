import { AccessApi, Rpcs } from "@stu/api";
import { Organization } from "@stu/core";
import { AccessRpcHandlers } from "@stu/server/access";
import { Auth } from "@stu/server/auth";
import { MarketingRpcHandlers } from "@stu/server/enquiry";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as HttpEffect from "effect/unstable/http/HttpEffect";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import {
  EnrollmentRateLimiter,
  forwardedPrincipalFromHeaders,
} from "#/infra/http/rate-limit.server.ts";
import { applicationRuntime } from "#/infra/runtime/lifecycle.server.ts";

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

const makeApplicationRpcEndpoint = Effect.gen(function* () {
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
});

type RpcEndpoint = (request: Request) => Promise<Response>;

interface RpcEndpointLifecycle {
  readonly endpoint: () => Promise<RpcEndpoint>;
  readonly dispose: () => Promise<void>;
  readonly state: () => "active" | "stopping" | "stopped";
}

const createRpcEndpointLifecycle = (): RpcEndpointLifecycle => {
  const scope = Scope.makeUnsafe();
  let endpoint: Promise<RpcEndpoint> | undefined;
  let shutdown: Promise<void> | undefined;
  let state: ReturnType<RpcEndpointLifecycle["state"]> = "active";

  return {
    endpoint: () =>
      (endpoint ??= applicationRuntime.runPromise(
        makeApplicationRpcEndpoint.pipe(Effect.provideService(Scope.Scope, scope)),
      )),
    dispose: () =>
      (shutdown ??= (async () => {
        state = "stopping";
        await Effect.runPromise(Scope.close(scope, Exit.void));
        state = "stopped";
      })()),
    state: () => state,
  };
};

const endpointKey = Symbol.for("@stu/web/application-rpc-endpoint");
const globalEndpoint = globalThis as typeof globalThis & {
  [endpointKey]?: RpcEndpointLifecycle;
};
const processCurrent = globalEndpoint[endpointKey];
const processCurrentState = processCurrent?.state();
const shouldReplaceCurrent =
  processCurrent !== undefined &&
  (processCurrentState === "stopping" ||
    processCurrentState === "stopped" ||
    import.meta.hot?.data.applicationRpcEndpoint === processCurrent);

const makeActiveRpcEndpointLifecycle = (previous?: RpcEndpointLifecycle): RpcEndpointLifecycle => {
  const current = createRpcEndpointLifecycle();
  let activation: Promise<RpcEndpoint> | undefined;
  return {
    ...current,
    endpoint: () =>
      (activation ??= current.endpoint().then(async (endpoint) => {
        await previous?.dispose();
        return endpoint;
      })),
  };
};

const applicationRpcEndpointLifecycle =
  processCurrent === undefined || shouldReplaceCurrent
    ? makeActiveRpcEndpointLifecycle(shouldReplaceCurrent ? processCurrent : undefined)
    : processCurrent;

globalEndpoint[endpointKey] = applicationRpcEndpointLifecycle;
if (import.meta.hot !== undefined) {
  import.meta.hot.data.applicationRpcEndpoint = applicationRpcEndpointLifecycle;
}

export const applicationRpcEndpoint = applicationRpcEndpointLifecycle.endpoint;
export const disposeApplicationRpcEndpoint = applicationRpcEndpointLifecycle.dispose;
