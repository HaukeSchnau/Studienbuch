import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OperatorOnly } from "#/domain-ui/shell/app-error-states.tsx";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/_client/app/operator")({
  component: OperatorLayout,
});

/** The operator area. Says what it is to an account without a grant, rather than bouncing them. */
function OperatorLayout() {
  const { account } = useShell();
  return account.operator ? <Outlet /> : <OperatorOnly />;
}
