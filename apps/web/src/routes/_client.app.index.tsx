import { createFileRoute, redirect } from "@tanstack/react-router";
import { defaultContext } from "#/domain-ui/shell/contexts.ts";
import { redirectToContext } from "#/domain-ui/shell/context-redirect.ts";
import { rememberedContext } from "#/domain-ui/shell/remembered-context.ts";

export const Route = createFileRoute("/_client/app/")({
  beforeLoad: ({ context }) => {
    const selected = defaultContext(context.contexts, rememberedContext());
    if (selected === undefined) {
      redirect({ to: "/aktivieren", replace: true, throw: true });
      return;
    }
    redirectToContext(selected);
  },
});

/**
 * `/app` names no context, so its guard sends you to the remembered or first available one.
 *
 * A redirect rather than a page, because there is nothing true to show here: every screen belongs to
 * a context, and the shell has already worked out which one that is.
 */
