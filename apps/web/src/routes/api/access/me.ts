import { createFileRoute } from "@tanstack/react-router";
import { handleMe } from "#/features/auth/access.server.ts";

export const Route = createFileRoute("/api/access/me")({
  server: { handlers: { GET: ({ request }) => handleMe(request) } },
});
