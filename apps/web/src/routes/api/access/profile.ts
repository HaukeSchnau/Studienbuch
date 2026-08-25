import { createFileRoute } from "@tanstack/react-router";
import { handleProfile } from "#/features/auth/access.server.ts";

export const Route = createFileRoute("/api/access/profile")({
  server: { handlers: { POST: ({ request }) => handleProfile(request) } },
});
