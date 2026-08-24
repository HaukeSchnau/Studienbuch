import { externalLinks, sectionIds } from "#/domain-ui/brand/links.ts";
import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";
import { Container } from "#/ui/section.tsx";

/**
 * TODO: German commercial sites need an Impressum (§5 DDG) and a Datenschutzerklärung. Link both
 * here once those routes exist; until then this footer deliberately points only at live pages.
 */
export const SiteFooter = () => (
  <footer className="border-t border-neutral-sec bg-background py-12">
    <Container className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <Wordmark />
        <p className="text-sm text-ink-soft">Ein Produkt der Urbs UG (haftungsbeschränkt).</p>
      </div>

      <nav aria-label="Fußzeile">
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-ink-soft">
          <li>
            <a
              className="transition-colors hover:text-primary-text"
              href={`#${sectionIds.capabilities}`}
            >
              Funktionen
            </a>
          </li>
          <li>
            <a
              className="transition-colors hover:text-primary-text"
              href={`#${sectionIds.schools}`}
            >
              Für Schulen
            </a>
          </li>
          <li>
            <a
              className="transition-colors hover:text-primary-text"
              href={externalLinks.schoolContact}
            >
              Kontakt
            </a>
          </li>
        </ul>
      </nav>
    </Container>
  </footer>
);
