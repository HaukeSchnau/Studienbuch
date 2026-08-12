import { createFileRoute } from "@tanstack/react-router";
import { handleCanary } from "#/server-adapters/health.server.ts";

export const Route = createFileRoute("/api/observability/v1/canary")({
  server: { handlers: { GET: ({ request }) => handleCanary(request) } },
});
