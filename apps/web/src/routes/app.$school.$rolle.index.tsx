import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useContextNavigation } from "#/domain-ui/shell/use-context-navigation.ts";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/app/$school/$rolle/")({ component: ContextIndex });

/** A context without a destination opens on its first one. */
function ContextIndex() {
  const { context } = useShell();
  const goToContext = useContextNavigation();

  useEffect(() => {
    goToContext(context.ref, { replace: true });
  }, [context.ref, goToContext]);

  return null;
}
