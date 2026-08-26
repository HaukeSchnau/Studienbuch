import { authRequests, logErrorEvent, logInfoEvent, spanAttributes } from "@stu/observability";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Metric from "effect/Metric";
import { exitFailureResponse, jsonResponse } from "#/infra/http/response.server.ts";
import { runRouteEffect, type RouteEffectRunner } from "#/infra/runtime/request.server.ts";

export const authRoute = "/api/auth/*";

type AuthOperation =
  | "auth.other"
  | "auth.password_reset.complete"
  | "auth.password_reset.request"
  | "auth.session.get"
  | "auth.sign_out"
  | "auth.sign_in.email"
  | "auth.sign_in.passkey.challenge"
  | "auth.sign_in.passkey.verify"
  | "auth.sign_up.email"
  | "auth.verify_email"
  | "auth.passkey.register.challenge"
  | "auth.passkey.register.verify"
  | "auth.passkey.list"
  | "auth.passkey.delete";

interface AuthHandler {
  readonly handler: (request: Request) => Promise<Response>;
}

class AuthResponseFailure extends Data.TaggedError("AuthResponseFailure")<{
  readonly response: Response;
}> {}

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
    case "/api/auth/sign-out":
      return "auth.sign_out";
    case "/api/auth/request-password-reset":
      return "auth.password_reset.request";
    case "/api/auth/reset-password":
      return "auth.password_reset.complete";
    case "/api/auth/verify-email":
      return "auth.verify_email";
    case "/api/auth/passkey/generate-register-options":
      return "auth.passkey.register.challenge";
    case "/api/auth/passkey/verify-registration":
      return "auth.passkey.register.verify";
    case "/api/auth/passkey/list-user-passkeys":
      return "auth.passkey.list";
    case "/api/auth/passkey/delete-passkey":
      return "auth.passkey.delete";
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
    const authOperationSpan = Effect.tryPromise(() =>
      resolveAuth().then((auth) => auth.handler(request)),
    ).pipe(
      Effect.tap((response) => {
        const outcome = response.ok ? "success" : "failure";
        return Effect.all([
          Effect.annotateCurrentSpan(spanAttributes({ "app.operation": operation, outcome })),
          Metric.update(
            Metric.withAttributes(authRequests, [
              ["auth.operation", operation],
              ["outcome", outcome],
            ]),
            1,
          ),
          request.method === "POST"
            ? logInfoEvent("auth.request.completed", {
                auth_operation: operation,
                http_status: response.status,
                outcome,
              })
            : Effect.void,
        ]);
      }),
      Effect.tapError(() =>
        Effect.all([
          Metric.update(
            Metric.withAttributes(authRequests, [
              ["auth.operation", operation],
              ["outcome", "failure"],
            ]),
            1,
          ),
          logErrorEvent("auth.request.failed", {
            auth_operation: operation,
            outcome: "failure",
          }),
        ]),
      ),
      Effect.flatMap((response) =>
        response.ok ? Effect.succeed(response) : Effect.fail(new AuthResponseFailure({ response })),
      ),
      Effect.withSpan(operation, {}, { captureStackTrace: false }),
    );
    const program = authOperationSpan.pipe(
      Effect.catchTag("AuthResponseFailure", ({ response }) => Effect.succeed(response)),
    );
    const exit = await run(program, { request, route: authRoute });
    const failure = exitFailureResponse(exit);
    if (failure !== undefined) return failure;
    return Exit.isSuccess(exit) ? exit.value : jsonResponse({ error: "internal_error" }, 500);
  };
}

export const handleAuthRequest = makeAuthRequestHandler();
