import { createFileRoute } from "@tanstack/react-router";
import { applicationRuntime } from "#/infra/runtime/lifecycle.server.ts";
import { ApplicationRpcEndpoint } from "#/infra/rpc/endpoint.server.ts";

export const Route = createFileRoute("/api/rpc")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        (await applicationRuntime.runPromise(ApplicationRpcEndpoint))(request),
    },
  },
});
