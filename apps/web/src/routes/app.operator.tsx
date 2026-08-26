import { createFileRoute, Outlet } from "@tanstack/react-router";
import { UnknownContext } from "#/domain-ui/shell/unknown-context.tsx";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/app/operator")({ component: OperatorContextLayout });

/**
 * The operator context.
 *
 * Gated on the grant rather than on the path, so that typing `/app/operator` gets an account without
 * one exactly what it gets for any other context it does not hold.
 */
function OperatorContextLayout() {
  const { account } = useShell();
  return account.operator ? <Outlet /> : <UnknownContext />;
}
