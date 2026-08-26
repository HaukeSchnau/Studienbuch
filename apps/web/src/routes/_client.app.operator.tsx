import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_client/app/operator")({
  beforeLoad: ({ context }) => {
    if (!context.account.operator) {
      redirect({ to: "/app", replace: true, throw: true });
    }
  },
  component: Outlet,
});
