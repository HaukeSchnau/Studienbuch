import { createFileRoute } from "@tanstack/react-router";
import { School } from "lucide-react";
import { DestinationPage, NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";

export const Route = createFileRoute("/_client/app/operator/schulen")({
  component: SchoolsPage,
  head: () => ({ meta: [{ title: "Schulen · Operator | Studienbuch" }] }),
});

function SchoolsPage() {
  return (
    <DestinationPage lead="Alle Schulen auf Studienbuch" title="Schulen">
      <NothingHereYet icon={School}>
        Hier stehen bald alle Schulen auf Studienbuch. Bis dahin legt sie die Konsole an:
        <span className="font-mono"> just console access-codes</span>.
      </NothingHereYet>
    </DestinationPage>
  );
}
