import { createFileRoute, redirect } from "@tanstack/react-router";
import { Organization } from "@stu/core/organization";
import { redirectToContext } from "#/domain-ui/shell/context-redirect.ts";

export const Route = createFileRoute("/_client/app/operator/")({
  beforeLoad: ({ context }) => {
    const operator = context.contexts.find((candidate) =>
      Organization.sameContext(candidate.ref, Organization.operatorContext),
    );
    if (operator === undefined) {
      redirect({ to: "/app", replace: true, throw: true });
      return;
    }
    redirectToContext(operator);
  },
});

/** The operator context without a destination opens on its first one before rendering. */
