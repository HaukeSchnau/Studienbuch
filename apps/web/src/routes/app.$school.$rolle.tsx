import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Organization } from "@stu/core/organization";
import { UnknownContext } from "#/domain-ui/shell/unknown-context.tsx";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/app/$school/$rolle")({ component: SchoolContextLayout });

/**
 * A school context.
 *
 * The check is the point: these two segments come from the address bar, so they may name a school
 * this account has no access to, a role it does not hold there, or nothing at all. Each of those is
 * an ordinary answer rather than a fault, and none of them may render a destination.
 */
function SchoolContextLayout() {
  const { school, rolle } = Route.useParams();
  const { contexts, context } = useShell();
  const requested = Organization.parseContextSegments([school, rolle]);

  const held =
    requested !== undefined &&
    contexts.some((candidate) => Organization.sameContext(candidate.ref, requested));

  return held && Organization.sameContext(context.ref, requested) ? <Outlet /> : <UnknownContext />;
}
