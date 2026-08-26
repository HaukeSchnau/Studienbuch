import { createFileRoute } from "@tanstack/react-router";
import { handleAuthRequest } from "#/infra/auth/handler.server.ts";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => handleAuthRequest(request),
      POST: async ({ request }) => handleAuthRequest(request),
    },
  },
});
