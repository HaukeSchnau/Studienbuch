import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { destinationTitle } from "#/domain-ui/shell/contexts.ts";
import { DestinationPage, NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/_client/app/$school/$rolle/woche")({
  component: WeekPage,
  head: ({ match, params }) => ({
    meta: [
      {
        title: destinationTitle("Meine Woche", match.context.contexts, [
          params.school,
          params.rolle,
        ]),
      },
    ],
  }),
});

function WeekPage() {
  const { context } = useShell();

  return (
    <DestinationPage lead={context.title} title="Meine Woche">
      <NothingHereYet icon={CalendarDays}>
        Hier steht bald dein Stundenplan für die ganze Woche, mit den Kursen, die du selbst gewählt
        hast.
      </NothingHereYet>
    </DestinationPage>
  );
}
