import { createFileRoute } from "@tanstack/react-router";
import { handleLiveness } from "#/server-adapters/health.server.ts";

export const Route = createFileRoute("/api/health/live")({
  server: { handlers: { GET: () => handleLiveness() } },
});
