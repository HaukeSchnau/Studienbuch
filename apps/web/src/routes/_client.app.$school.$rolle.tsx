import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { findContext } from "#/domain-ui/shell/contexts.ts";

export const Route = createFileRoute("/_client/app/$school/$rolle")({
  beforeLoad: ({ context, params }) => {
    if (findContext(context.contexts, [params.school, params.rolle]) === undefined) {
      redirect({ to: "/app", replace: true, throw: true });
    }
  },
  component: Outlet,
});
