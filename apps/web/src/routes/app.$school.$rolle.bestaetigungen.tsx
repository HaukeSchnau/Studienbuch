import { createFileRoute } from "@tanstack/react-router";
import { DestinationPage, NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";

export const Route = createFileRoute("/app/$school/$rolle/bestaetigungen")({
  component: ConfirmationsPage,
  head: () => ({ meta: [{ title: "Bestätigungen | Studienbuch" }] }),
});

function ConfirmationsPage() {
  return (
    <DestinationPage title="Bestätigungen">
      <NothingHereYet>
        Hier warten bald die Noten und Fehlzeiten, die auf deine Unterschrift warten.
      </NothingHereYet>
    </DestinationPage>
  );
}
