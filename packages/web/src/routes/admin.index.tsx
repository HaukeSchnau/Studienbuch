import { createFileRoute } from "@tanstack/react-router";

import AdminPage from "~/legacy-next-app/app/admin/page";

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
});
