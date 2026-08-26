import { createFileRoute } from "@tanstack/react-router";
import { DestinationPage, NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";

export const Route = createFileRoute("/app/$school/$rolle/woche")({
  component: WeekPage,
  head: () => ({ meta: [{ title: "Meine Woche | Studienbuch" }] }),
});

function WeekPage() {
  return (
    <DestinationPage title="Meine Woche">
      <NothingHereYet>
        Hier steht bald dein Stundenplan für die ganze Woche, mit den Kursen, die du selbst gewählt
        hast.
      </NothingHereYet>
    </DestinationPage>
  );
}
