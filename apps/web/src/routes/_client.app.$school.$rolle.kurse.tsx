import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { destinationTitle } from "#/domain-ui/shell/contexts.ts";
import { DestinationPage, NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/_client/app/$school/$rolle/kurse")({
  component: CoursesPage,
  head: ({ match, params }) => ({
    meta: [
      {
        title: destinationTitle("Meine Kurse", match.context.contexts, [
          params.school,
          params.rolle,
        ]),
      },
    ],
  }),
});

function CoursesPage() {
  const { context } = useShell();

  return (
    <DestinationPage lead={context.title} title="Meine Kurse">
      <NothingHereYet icon={GraduationCap}>
        Hier stehen bald die Kurse, die du unterrichtest, mit den Schülerinnen und Schülern darin.
      </NothingHereYet>
    </DestinationPage>
  );
}
