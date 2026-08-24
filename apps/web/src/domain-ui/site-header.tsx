import { externalLinks, sectionIds } from "#/domain-ui/brand/links.ts";

const navItems = [
  { href: `#${sectionIds.capabilities}`, label: "Funktionen" },
  { href: `#${sectionIds.schools}`, label: "Für Schulen" },
  { href: `#${sectionIds.app}`, label: "App laden" },
] as const;

/**
 * The legacy site's chrome was a single green pill, only as wide as its links, floating centred
 * above a white page. That silhouette is the site's signature, so it is kept exactly.
 *
 * It is filled with `primary-text` rather than the lighter greens the legacy pill used: white on
 * those is under 3:1, which nav links at this size cannot carry.
 */
export const SiteHeader = () => (
  <header className="flex justify-center px-6 pt-6 sm:pt-8">
    <nav
      aria-label="Hauptnavigation"
      className="flex w-fit items-center gap-5 rounded-full bg-primary-text px-6 py-3.5 text-white shadow-float sm:gap-8 sm:px-8"
    >
      {navItems.map((item) => (
        <a
          className="rounded-sm text-sm font-bold whitespace-nowrap transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none sm:text-base"
          href={item.href}
          key={item.href}
        >
          {item.label}
        </a>
      ))}
      <a
        className="hidden rounded-sm text-sm font-bold whitespace-nowrap transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none sm:inline sm:text-base"
        href={externalLinks.schoolContact}
      >
        Kontakt
      </a>
    </nav>
  </header>
);
