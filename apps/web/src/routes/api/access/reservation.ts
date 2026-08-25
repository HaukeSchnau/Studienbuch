import { createFileRoute } from "@tanstack/react-router";
import { handleReservation } from "#/features/auth/access.server.ts";

export const Route = createFileRoute("/api/access/reservation")({
  server: { handlers: { POST: ({ request }) => handleReservation(request) } },
});
