import { Outlet, createFileRoute } from "@tanstack/react-router";

import { requirePermission } from "~/routes/_guards";

export const Route = createFileRoute("/admin/people")({
  beforeLoad: async () => {
    await requirePermission("EDIT_USERS");
  },
  component: Outlet,
});
