import { createFileRoute } from "@tanstack/react-router";
import { handleCanary } from "#/infra/http/health.server.ts";

export const Route = createFileRoute("/api/observability/v1/canary")({
  server: { handlers: { GET: ({ request }) => handleCanary(request) } },
});
