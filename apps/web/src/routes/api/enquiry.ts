import { createFileRoute } from "@tanstack/react-router";
import { handleEnquiry } from "#/features/marketing/enquiry.server.ts";

export const Route = createFileRoute("/api/enquiry")({
  server: { handlers: { POST: ({ request }) => handleEnquiry(request) } },
});
