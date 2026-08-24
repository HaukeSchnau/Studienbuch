import { Link } from "@tanstack/react-router";

import { externalLinks, sectionIds } from "#/domain-ui/brand/links.ts";
import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";
import { Button } from "#/ui/button.tsx";
import { Container } from "#/ui/section.tsx";

const navItems = [
  { href: `#${sectionIds.capabilities}`, label: "Funktionen" },
  { href: `#${sectionIds.schools}`, label: "Für Schulen" },
] as const;

/**
 * The floating pill nav is the legacy site's one piece of chrome worth keeping. It has moved from
 * a green pill on white to a frosted white pill, because it now floats on the green header instead
 * of sitting beside it.
 *
 * It is `fixed` rather than `sticky` so it stays out of the document flow and the hero's green can
 * run all the way to the top of the page behind it. The hero pads itself to clear it.
 */
export const SiteHeader = () => (
  <header className="fixed inset-x-0 top-0 z-50 pt-4 sm:pt-6">
    <Container>
      <nav
        aria-label="Hauptnavigation"
        className="flex items-center gap-3 rounded-full bg-surface/95 py-2.5 pr-2.5 pl-4 shadow-float backdrop-blur-md sm:gap-6 sm:pl-6"
      >
        <Link aria-label="Studienbuch, zur Startseite" className="shrink-0 rounded-full" to="/">
          <Wordmark />
        </Link>

        <ul className="hidden flex-1 items-center gap-6 text-sm font-semibold text-ink-soft sm:flex">
          {navItems.map((item) => (
            <li key={item.href}>
              <a className="rounded-sm transition-colors hover:text-primary-text" href={item.href}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto sm:ml-0">
          <Button asChild radius="pill" variant="brand">
            <a href={externalLinks.schoolContact}>Schule anfragen</a>
          </Button>
        </div>
      </nav>
    </Container>
  </header>
);
