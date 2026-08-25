import { Link } from "@tanstack/react-router";

import { externalLinks, sectionHref, sectionIds } from "#/domain-ui/brand/links.ts";
import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";
import { Container } from "#/ui/section.tsx";

const linkClass = "rounded-sm transition-colors hover:text-primary-text";

/**
 * Impressum and Datenschutzerklärung sit in their own row, apart from the marketing links. §5 DDG
 * requires the Impressum to be reachable from every page and easy to find, which grouping it
 * separately serves better than burying it among section anchors.
 */
export const SiteFooter = () => (
  <footer className="border-t border-neutral-sec bg-background py-12">
    <Container className="flex flex-col gap-8">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Wordmark />
          <p className="text-sm text-ink-soft">Eine Hauke Schnau Produktion</p>
        </div>

        <nav aria-label="Fußzeile">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-ink-soft">
            <li>
              <a className={linkClass} href={sectionHref(sectionIds.capabilities)}>
                Funktionen
              </a>
            </li>
            <li>
              <a className={linkClass} href={sectionHref(sectionIds.schools)}>
                Für Schulen
              </a>
            </li>
            <li>
              <a className={linkClass} href={externalLinks.schoolContact}>
                Kontakt
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <nav
        aria-label="Rechtliches"
        className="border-t border-neutral-sec pt-6 text-sm text-ink-soft"
      >
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <li>
            <Link className={linkClass} to="/impressum">
              Impressum
            </Link>
          </li>
          <li>
            <Link className={linkClass} to="/datenschutz">
              Datenschutz
            </Link>
          </li>
        </ul>
      </nav>
    </Container>
  </footer>
);
