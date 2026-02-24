import { createFileRoute } from "@tanstack/react-router";

import UsersPage from "~/legacy-next-app/app/admin/users/page";

export const Route = createFileRoute("/admin/users/")({
  component: UsersPage,
});
