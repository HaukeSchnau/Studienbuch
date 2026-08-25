import { createFileRoute } from "@tanstack/react-router";
import { handleComplete } from "#/features/auth/access.server.ts";

export const Route = createFileRoute("/api/access/complete")({
  server: { handlers: { POST: ({ request }) => handleComplete(request) } },
});
