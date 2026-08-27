import { createFileRoute } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { DestinationPage, NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";

export const Route = createFileRoute("/_client/app/operator/zugangscodes")({
  component: AccessCodesPage,
  head: () => ({ meta: [{ title: "Zugangscodes · Operator | Studienbuch" }] }),
});

function AccessCodesPage() {
  return (
    <DestinationPage lead="Ausgegeben, vorgemerkt, eingelöst" title="Zugangscodes">
      <NothingHereYet icon={KeyRound}>
        Hier lassen sich bald Code-Stapel erzeugen und ihr Stand verfolgen: ausgegeben, vorgemerkt,
        eingelöst, abgelaufen.
      </NothingHereYet>
    </DestinationPage>
  );
}
