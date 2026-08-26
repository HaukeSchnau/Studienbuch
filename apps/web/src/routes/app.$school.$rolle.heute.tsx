import { createFileRoute } from "@tanstack/react-router";
import { shortName } from "#/domain-ui/person-name.ts";
import { NothingHereYet } from "#/domain-ui/shell/destination-page.tsx";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/app/$school/$rolle/heute")({
  component: OverviewPage,
  head: () => ({ meta: [{ title: "Übersicht | Studienbuch" }] }),
});

/**
 * Where a student's day starts.
 *
 * It greets the way the app greets — "Moin, {name}!" — because this is the same product as the
 * phone in their pocket. But it greets briefly: this is the screen opened every morning, and the
 * greeting is not what anyone came for. The agenda is, so the greeting is a band rather than a
 * hero, and the space goes to what will sit underneath it.
 *
 * No pointer-following light and no entrance animation here either. Both are landing-page devices
 * for a page that has to sell itself once; a screen that has already been chosen should simply be
 * ready.
 */
function OverviewPage() {
  const { context } = useShell();
  const name = context.access?.displayName ?? null;

  return (
    <main className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <section className="rounded-card bg-primary px-5 py-4 sm:px-6 sm:py-5">
        <h1 className="text-2xl text-white sm:text-3xl">
          {name === null ? "Moin!" : `Moin, ${shortName(name)}!`}
        </h1>
        <p className="mt-1 text-sm text-white/90">{context.title}</p>
      </section>
      <div className="mt-5">
        <NothingHereYet>
          Hier steht bald dein Tagesplan: die Stunden, die heute anstehen, mit Vertretungen und
          Ausfällen.
        </NothingHereYet>
      </div>
    </main>
  );
}
