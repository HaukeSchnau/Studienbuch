import { createFileRoute } from "@tanstack/react-router";
import { Organization } from "@stu/core/organization";
import { redirectToContext } from "#/domain-ui/shell/context-redirect.ts";

export const Route = createFileRoute("/_client/app/operator/")({
  beforeLoad: ({ context }) => {
    const operator = context.contexts.find((candidate) =>
      Organization.sameContext(candidate.ref, Organization.operatorContext),
    );
    // No grant: the layout above renders the refusal rather than this sending them elsewhere.
    if (operator === undefined) return;
    redirectToContext(operator);
  },
});

/** The operator context without a destination opens on its first one before rendering. */
