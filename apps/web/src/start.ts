import { createMiddleware, createStart } from "@tanstack/react-start";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { runRouteEffect } from "#/infra/runtime/request.server.ts";

const requestObservability = createMiddleware({ type: "request" }).server(
  async ({ request, pathname, handlerType, next }) => {
    // API handlers have their own stable route names and richer boundaries. This layer owns the
    // otherwise invisible document render and server-function requests.
    if (pathname.startsWith("/api/")) return next();

    const route = handlerType === "router" ? "/*" : "/_serverFn";
    const exit = await runRouteEffect(
      Effect.tryPromise((_signal) => Promise.resolve(next())),
      { request, route },
    );
    if (Exit.isSuccess(exit)) return exit.value.response;
    return new Response(null, { status: 500 });
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [requestObservability],
}));
