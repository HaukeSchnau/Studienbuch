import { createFileRoute } from "@tanstack/react-router";
import { handleReadiness } from "#/infra/http/health.server.ts";

export const Route = createFileRoute("/api/health/ready")({
  server: { handlers: { GET: () => handleReadiness() } },
});
