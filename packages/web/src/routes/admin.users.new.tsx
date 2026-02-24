import { createFileRoute } from "@tanstack/react-router";

import NewUserPage from "~/legacy-next-app/app/admin/users/new/page";

export const Route = createFileRoute("/admin/users/new")({
  component: NewUserPage,
});
