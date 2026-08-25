import { createFileRoute } from "@tanstack/react-router";
import { AccessRpcEndpoint } from "#/features/auth/rpc.server.ts";
import { applicationRuntime } from "#/infra/runtime/lifecycle.server.ts";

export const Route = createFileRoute("/api/rpc")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        (await applicationRuntime.runPromise(AccessRpcEndpoint))(request),
    },
  },
});
