import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";
import { AccountMenu } from "./account-menu.tsx";
import { ConnectionState } from "./connection-state.tsx";
import { DestinationLink } from "./destination-link.tsx";
import { destinationsFor } from "./destinations.ts";
import { useShell } from "./shell-state.tsx";

/*
 * Every interactive thing in the chrome carries the same focus ring. The public site has rung its
 * links since it was built; the rail — the most keyboard-driven surface in the whole product — was
 * left with nothing but the browser's default outline on a fully rounded shape.
 */
const focusRing = "focus-visible:ring-2 focus-visible:ring-primary-pale focus-visible:outline-none";

const railLink = `press flex items-center gap-3 rounded-full px-4 py-2 text-sm text-ink hover:bg-primary-des/60 data-[active=true]:bg-primary-des data-[active=true]:font-bold data-[active=true]:text-primary-text ${focusRing}`;

const barLink = `press group flex min-w-0 grow basis-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-xs text-ink-soft data-[active=true]:font-bold data-[active=true]:text-primary-text ${focusRing}`;

const legalLink = `rounded-sm hover:text-ink ${focusRing}`;

/**
 * Impressum and Datenschutz, from inside the application.
 *
 * §5 DDG wants the Impressum reachable from every page, and the shell had neither link — the public
 * footer carries them and the application has no footer. They open in a new tab because those pages
 * live in the marketing chrome: following one in place would strand somebody in the middle of the
 * landing page with no route back to what they were doing.
 */
const LegalLinks = ({ className }: { readonly className?: string }) => (
  <nav aria-label="Rechtliches" className={className}>
    <a className={legalLink} href="/impressum" rel="noopener" target="_blank">
      Impressum
    </a>
    <a className={legalLink} href="/datenschutz" rel="noopener" target="_blank">
      Datenschutz
    </a>
  </nav>
);

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
 *
 * It reads the shell rather than being handed it. The layout above already resolves the active
 * context and provides it, and taking the same two values as props meant a second copy that could
 * disagree with what every destination below was reading.
 */
export const AppShell = ({ children }: { readonly children: ReactNode }) => {
  const { context } = useShell();
  const destinations = destinationsFor(context.ref);

  return (
    <div className="app-page min-h-screen bg-primary-des md:flex">
      {/* Up to seven links and a menu stand between the top of the page and the content, on every
          screen. Without this a keyboard reaches the timetable by tabbing past all of them. */}
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-text focus:shadow-float"
        href="#hauptinhalt"
      >
        Direkt zum Inhalt
      </a>

      <nav
        aria-label="Hauptbereiche"
        className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-neutral-sec/60 bg-white px-3 py-5 md:flex"
        data-testid="expanded-main-navigation"
      >
        {/* Home is the application, not the landing page. The most-clicked mark in the chrome
            should not eject someone from the thing they are using. */}
        <Link className={`press mb-4 rounded-sm px-2 ${focusRing}`} to="/app">
          <Wordmark />
        </Link>
        <AccountMenu />
        <ul className="mt-4 grid gap-0.5">
          {destinations.map((destination) => (
            <li key={destination.id}>
              <DestinationLink className={railLink} context={context} destination={destination}>
                <destination.icon className="size-5" />
                {destination.label}
              </DestinationLink>
            </li>
          ))}
        </ul>
        <LegalLinks className="mt-auto flex gap-4 px-4 pt-4 text-xs text-ink-soft" />
      </nav>

      <div className="min-w-0 grow pb-24 md:pb-0">
        {/* Only below `md`, where the rail and everything in it is hidden. */}
        <header className="flex items-center justify-between gap-3 bg-white px-4 py-2.5 shadow-card md:hidden">
          <Link className={`press rounded-sm ${focusRing}`} to="/app">
            <Wordmark />
          </Link>
          <AccountMenu compact />
        </header>
        <ConnectionState />
        <div id="hauptinhalt" tabIndex={-1}>
          {children}
        </div>
        <LegalLinks className="flex justify-center gap-5 px-5 pt-2 pb-6 text-xs text-ink-soft md:hidden" />
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
            {/* The selected tab fills a pill behind its icon, the way the legacy bar marks one.
                Bolder text alone is not legible as "you are here" at a glance. */}
            <span className="grid h-7 w-12 place-items-center rounded-full transition-colors group-data-[active=true]:bg-primary-des">
              <destination.icon className="size-5" />
            </span>
            <span className="w-full truncate text-center">{destination.label}</span>
          </DestinationLink>
        ))}
      </nav>
    </div>
  );
};
