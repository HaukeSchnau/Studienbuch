import { createFileRoute } from "@tanstack/react-router";
import { DestinationPage, NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";

export const Route = createFileRoute("/app/operator/zugangscodes")({
  component: AccessCodesPage,
  head: () => ({ meta: [{ title: "Zugangscodes | Studienbuch" }] }),
});

function AccessCodesPage() {
  return (
    <DestinationPage title="Zugangscodes">
      <NothingHereYet>
        Hier lassen sich bald Code-Stapel erzeugen und ihr Stand verfolgen: ausgegeben, vorgemerkt,
        eingelöst, abgelaufen.
      </NothingHereYet>
    </DestinationPage>
  );
}
