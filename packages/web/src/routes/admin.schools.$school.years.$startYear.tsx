import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/schools/$school/years/$startYear")({
  component: Outlet,
});
