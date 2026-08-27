import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { ContextNotAvailable } from "#/domain-ui/shell/app-error-states.tsx";
import { findContext } from "#/domain-ui/shell/contexts.ts";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/_client/app/$school/$rolle")({
  component: SchoolContextLayout,
});

/**
 * Everything belonging to one school access.
 *
 * The check is here rather than in a guard because a guard can only redirect, and redirecting is
 * the wrong answer: the person asked for a specific school and would arrive at a different one
 * without ever being told. Rendering the refusal keeps them where the link pointed and says why.
 */
function SchoolContextLayout() {
  const { contexts } = useShell();
  const { school, rolle } = useParams({ from: "/_client/app/$school/$rolle" });

  return findContext(contexts, [school, rolle]) === undefined ? (
    <ContextNotAvailable />
  ) : (
    <Outlet />
  );
}
