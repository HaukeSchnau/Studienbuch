import { spanAttributes } from "@stu/observability";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { exitFailureResponse, jsonResponse } from "#/infra/http/response.server.ts";
import { runRouteEffect, type RouteEffectRunner } from "#/infra/runtime/request.server.ts";

export const authRoute = "/api/auth/*";

type AuthOperation =
  | "auth.other"
  | "auth.session.get"
  | "auth.sign_in.email"
  | "auth.sign_in.passkey.challenge"
  | "auth.sign_in.passkey.verify"
  | "auth.sign_up.email";

interface AuthHandler {
  readonly handler: (request: Request) => Promise<Response>;
}

export function authOperation(request: Request): AuthOperation {
  switch (new URL(request.url).pathname) {
    case "/api/auth/get-session":
      return "auth.session.get";
    case "/api/auth/sign-in/email":
      return "auth.sign_in.email";
    case "/api/auth/passkey/generate-authenticate-options":
      return "auth.sign_in.passkey.challenge";
    case "/api/auth/passkey/verify-authentication":
      return "auth.sign_in.passkey.verify";
    case "/api/auth/sign-up/email":
      return "auth.sign_up.email";
    default:
      return "auth.other";
  }
}

/**
 * Traces the Better Auth boundary under one stable route. Logs contain only the normalized
 * operation, outcome, and status: never a URL, query, header, credential, or request body.
 */
export function makeAuthRequestHandler(options?: {
  readonly resolveAuth?: () => Promise<AuthHandler>;
  readonly run?: RouteEffectRunner<never>;
}) {
  const resolveAuth =
    options?.resolveAuth ??
    (() => import("#/infra/auth/better-auth.ts").then(({ getAuth }) => getAuth()));
  const run = options?.run ?? runRouteEffect;

  return async (request: Request): Promise<Response> => {
    const operation = authOperation(request);
    const program = Effect.tryPromise(() =>
      resolveAuth().then((auth) => auth.handler(request)),
    ).pipe(
      Effect.tap((response) => {
        const outcome = response.ok ? "success" : "failure";
        return Effect.all([
          Effect.annotateCurrentSpan(spanAttributes({ "app.operation": operation, outcome })),
          request.method === "POST"
            ? Effect.logInfo("auth.request.completed", {
                auth_operation: operation,
                event: "auth.request.completed",
                http_status: response.status,
                outcome,
              })
            : Effect.void,
        ]);
      }),
      Effect.tapError(() =>
        Effect.logError("auth.request.failed", {
          auth_operation: operation,
          event: "auth.request.failed",
          outcome: "failure",
        }),
      ),
    );
    const exit = await run(program, { request, route: authRoute });
    const failure = exitFailureResponse(exit);
    if (failure !== undefined) return failure;
    return Exit.isSuccess(exit) ? exit.value : jsonResponse({ error: "internal_error" }, 500);
  };
}

export const handleAuthRequest = makeAuthRequestHandler();
