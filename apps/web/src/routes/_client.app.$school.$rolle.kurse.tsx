import { createFileRoute } from "@tanstack/react-router";
import { DestinationPage, NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";

export const Route = createFileRoute("/_client/app/$school/$rolle/kurse")({
  component: CoursesPage,
  head: () => ({ meta: [{ title: "Meine Kurse | Studienbuch" }] }),
});

function CoursesPage() {
  return (
    <DestinationPage title="Meine Kurse">
      <NothingHereYet>
        Hier stehen bald die Kurse, die du unterrichtest, mit den Schülerinnen und Schülern darin.
      </NothingHereYet>
    </DestinationPage>
  );
}
