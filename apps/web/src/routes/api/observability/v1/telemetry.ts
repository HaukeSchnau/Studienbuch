import { createFileRoute } from "@tanstack/react-router";
import { handleTelemetryIngress } from "#/server-adapters/telemetry-ingress.server.ts";

export const Route = createFileRoute("/api/observability/v1/telemetry")({
  server: { handlers: { POST: ({ request }) => handleTelemetryIngress(request) } },
});
