import { createFileRoute } from "@tanstack/react-router";
import { House } from "lucide-react";
import { shortName } from "#/domain-ui/person-name.ts";
import { destinationTitle } from "#/domain-ui/shell/contexts.ts";
import { DestinationPage, NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/_client/app/$school/$rolle/heute")({
  component: OverviewPage,
  head: ({ match, params }) => ({
    meta: [
      {
        title: destinationTitle("Übersicht", match.context.contexts, [params.school, params.rolle]),
      },
    ],
  }),
});

/**
 * Where a student's day starts.
 *
 * It greets the way the app greets — "Moin, {name}!" — because this is the same product as the
 * phone in their pocket. The greeting is the page's title rather than a green band of its own: this
 * screen is opened every morning and the greeting is not what anyone came for, so it takes the same
 * room every other destination's heading takes and leaves the rest to the agenda.
 *
 * No pointer-following light and no entrance animation here either. Both are landing-page devices
 * for a page that has to sell itself once; a screen that has already been chosen should simply be
 * ready.
 */
function OverviewPage() {
  const { context } = useShell();
  const name = context.access?.displayName ?? null;

  return (
    <DestinationPage
      lead={context.title}
      title={name === null ? "Moin!" : `Moin, ${shortName(name)}!`}
    >
      <NothingHereYet icon={House}>
        Hier steht bald dein Tagesplan: die Stunden, die heute anstehen, mit Vertretungen und
        Ausfällen.
      </NothingHereYet>
    </DestinationPage>
  );
}
