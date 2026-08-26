import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";
import { ContextSwitcher } from "./context-switcher.tsx";
import { DestinationLink } from "./destination-link.tsx";
import { destinationsFor } from "./destinations.ts";
import type { ShellContext } from "./contexts.ts";

const railLink =
  "press flex items-center gap-3 rounded-full px-4 py-2.5 text-base text-ink hover:bg-primary-des/60 data-[active=true]:bg-primary-des data-[active=true]:font-bold data-[active=true]:text-primary-text";

const barLink =
  "press flex min-w-0 grow basis-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-xs text-ink-soft data-[active=true]:font-bold data-[active=true]:text-primary-text";

/**
 * The chrome every signed-in screen sits in.
 *
 * Two presentations of one navigation, chosen by width — which is what the legacy app did with a
 * `NavigationRail` above the breakpoint and a `BottomNavigationBar` below it. Both are always in the
 * tree and one is hidden by CSS, so a resize cannot lose the current destination; the accepted
 * contract in `apps/mobile/e2e/scenarios/main-shell-responsive-navigation.md` requires exactly that.
 *
 * The destinations come from the active context's capabilities, so a student at one school sees the
 * same handful of entries the legacy app had and never learns that any of this is general.
 */
export const AppShell = ({
  children,
  context,
  contexts,
}: {
  readonly children: ReactNode;
  readonly context: ShellContext;
  readonly contexts: ReadonlyArray<ShellContext>;
}) => {
  const destinations = destinationsFor(context.ref);

  return (
    <div className="min-h-screen bg-primary-des md:flex">
      <nav
        aria-label="Hauptbereiche"
        className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-neutral-sec/60 bg-white px-4 py-6 md:flex"
        data-testid="expanded-main-navigation"
      >
        <Link className="press mb-5 px-2" to="/">
          <Wordmark />
        </Link>
        <ContextSwitcher active={context} contexts={contexts} />
        <ul className="mt-5 grid gap-1">
          {destinations.map((destination) => (
            <li key={destination.id}>
              <DestinationLink className={railLink} context={context} destination={destination}>
                <destination.icon className="size-5" />
                {destination.label}
              </DestinationLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 grow pb-24 md:pb-0">
        {/* Only below `md`, where the rail and everything in it is hidden. */}
        <header className="flex items-center justify-between gap-4 bg-white px-5 py-3 shadow-card md:hidden">
          <Link className="press" to="/">
            <Wordmark />
          </Link>
          <ContextSwitcher active={context} compact contexts={contexts} />
        </header>
        {children}
      </div>

      <nav
        aria-label="Hauptbereiche"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-neutral-sec/60 bg-white px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
        data-testid="compact-main-navigation"
      >
        {destinations.map((destination) => (
          <DestinationLink
            className={barLink}
            context={context}
            destination={destination}
            key={destination.id}
          >
            <destination.icon className="size-5" />
            <span className="w-full truncate text-center">{destination.label}</span>
          </DestinationLink>
        ))}
      </nav>
    </div>
  );
};
