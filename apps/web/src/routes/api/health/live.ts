import { createFileRoute } from "@tanstack/react-router";
import { handleLiveness } from "#/infra/http/health.server.ts";

export const Route = createFileRoute("/api/health/live")({
  server: { handlers: { GET: () => handleLiveness() } },
});
