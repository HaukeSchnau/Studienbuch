import { createFileRoute } from "@tanstack/react-router";
import { DestinationPage, NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";

export const Route = createFileRoute("/_client/app/operator/schulen")({
  component: SchoolsPage,
  head: () => ({ meta: [{ title: "Schulen | Studienbuch" }] }),
});

function SchoolsPage() {
  return (
    <DestinationPage title="Schulen">
      <NothingHereYet>
        Hier stehen bald alle Schulen auf Studienbuch. Bis dahin legt sie die Konsole an:
        <span className="font-mono"> just console access-codes</span>.
      </NothingHereYet>
    </DestinationPage>
  );
}
