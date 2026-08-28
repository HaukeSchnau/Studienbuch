import { createFileRoute } from "@tanstack/react-router";
import { applicationRpcEndpoint } from "#/infra/rpc/endpoint.server.ts";

export const Route = createFileRoute("/api/rpc")({
  server: {
    handlers: {
      POST: async ({ request }) => (await applicationRpcEndpoint())(request),
    },
  },
});
