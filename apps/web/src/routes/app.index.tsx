import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useContextNavigation } from "#/domain-ui/shell/use-context-navigation.ts";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/app/")({ component: AppIndex });

/**
 * `/app` names no context, so it sends you to the one you are in.
 *
 * A redirect rather than a page, because there is nothing true to show here: every screen belongs to
 * a context, and the shell has already worked out which one that is.
 */
function AppIndex() {
  const { context } = useShell();
  const goToContext = useContextNavigation();

  useEffect(() => {
    goToContext(context.ref, { replace: true });
  }, [context.ref, goToContext]);

  return null;
}
