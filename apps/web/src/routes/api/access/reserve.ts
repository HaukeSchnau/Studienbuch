import { createFileRoute } from "@tanstack/react-router";
import { handleReserve } from "#/features/auth/access.server.ts";

export const Route = createFileRoute("/api/access/reserve")({
  server: { handlers: { POST: ({ request }) => handleReserve(request) } },
});
