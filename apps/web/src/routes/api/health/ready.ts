import { createFileRoute } from "@tanstack/react-router";
import { handleReadiness } from "#/server-adapters/health.server.ts";

export const Route = createFileRoute("/api/health/ready")({
  server: { handlers: { GET: () => handleReadiness() } },
});
