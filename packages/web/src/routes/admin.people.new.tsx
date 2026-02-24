import { createFileRoute } from "@tanstack/react-router";

import NewPersonPage from "~/legacy-next-app/app/admin/people/new/page";

export const Route = createFileRoute("/admin/people/new")({
  component: NewPersonPage,
});
