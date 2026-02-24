import { createFileRoute } from "@tanstack/react-router";

import PeoplePage from "~/legacy-next-app/app/admin/people/page";

export const Route = createFileRoute("/admin/people/")({
  component: PeoplePage,
});
