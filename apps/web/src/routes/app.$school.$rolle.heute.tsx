import { createFileRoute } from "@tanstack/react-router";
import { shortName } from "#/domain-ui/person-name.ts";
import { NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";
import { PointerSpot } from "#/ui/pointer-spot.tsx";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/app/$school/$rolle/heute")({
  component: OverviewPage,
  head: () => ({ meta: [{ title: "Übersicht | Studienbuch" }] }),
});

/**
 * Where a student's day starts.
 *
 * It opens the way the app opens — the brand's green and "Moin, {name}!" — because this is the same
 * product as the phone in their pocket. What goes under the greeting is the day's agenda; until that
 * exists the screen says so rather than showing an empty grid that looks broken.
 */
function OverviewPage() {
  const { context } = useShell();
  const name = context.access?.displayName ?? null;

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <PointerSpot className="enter relative overflow-hidden rounded-card-lg bg-primary px-6 py-7 sm:px-9 sm:py-9">
        <h1 className="text-4xl text-white sm:text-5xl">
          {name === null ? "Moin!" : `Moin, ${shortName(name)}!`}
        </h1>
        <p className="mt-2 max-w-lg text-lg/relaxed text-white/90">{context.title}</p>
      </PointerSpot>
      <div className="enter-late mt-6">
        <NothingHereYet>
          Hier steht bald dein Tagesplan: die Stunden, die heute anstehen, mit Vertretungen und
          Ausfällen.
        </NothingHereYet>
      </div>
    </main>
  );
}
