import { createFileRoute, redirect } from "@tanstack/react-router";
import { findContext } from "#/domain-ui/shell/contexts.ts";
import { redirectToContext } from "#/domain-ui/shell/context-redirect.ts";

export const Route = createFileRoute("/_client/app/$school/$rolle/")({
  beforeLoad: ({ context, params }) => {
    const selected = findContext(context.contexts, [params.school, params.rolle]);
    if (selected === undefined) {
      redirect({ to: "/app", replace: true, throw: true });
      return;
    }
    redirectToContext(selected);
  },
});

/** A context without a destination opens on its first one before rendering. */
