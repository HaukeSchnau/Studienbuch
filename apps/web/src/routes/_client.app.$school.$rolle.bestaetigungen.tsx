import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { destinationTitle } from "#/domain-ui/shell/contexts.ts";
import { DestinationPage, NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/_client/app/$school/$rolle/bestaetigungen")({
  component: ConfirmationsPage,
  head: ({ match, params }) => ({
    meta: [
      {
        title: destinationTitle("Bestätigungen", match.context.contexts, [
          params.school,
          params.rolle,
        ]),
      },
    ],
  }),
});

function ConfirmationsPage() {
  const { context } = useShell();

  return (
    <DestinationPage lead={context.title} title="Bestätigungen">
      <NothingHereYet icon={ClipboardCheck}>
        Hier warten bald die Noten und Fehlzeiten, die auf deine Unterschrift warten.
      </NothingHereYet>
    </DestinationPage>
  );
}
