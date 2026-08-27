import { createFileRoute } from "@tanstack/react-router";
import { findContext } from "#/domain-ui/shell/contexts.ts";
import { redirectToContext } from "#/domain-ui/shell/context-redirect.ts";

export const Route = createFileRoute("/_client/app/$school/$rolle/")({
  beforeLoad: ({ context, params }) => {
    const selected = findContext(context.contexts, [params.school, params.rolle]);
    // Not this account's context: fall through without redirecting, so the layout above can render
    // the explanation. A guard here would send them away before anything could be said.
    if (selected === undefined) return;
    redirectToContext(selected);
  },
});

/** A context without a destination opens on its first one before rendering. */
