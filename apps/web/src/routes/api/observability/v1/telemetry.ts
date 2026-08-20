import { createFileRoute } from "@tanstack/react-router";
import { handleTelemetryIngress } from "#/infra/observability/ingress.server.ts";

export const Route = createFileRoute("/api/observability/v1/telemetry")({
  server: { handlers: { POST: ({ request }) => handleTelemetryIngress(request) } },
});
