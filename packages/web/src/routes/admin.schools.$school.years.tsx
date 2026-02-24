import { Outlet, createFileRoute } from "@tanstack/react-router";

import { requirePermission } from "~/routes/_guards";

export const Route = createFileRoute("/admin/schools/$school/years")({
  beforeLoad: async () => {
    await requirePermission("EDIT_YEARS");
  },
  component: Outlet,
});
