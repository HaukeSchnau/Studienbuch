import { Site } from "./Site.ts";
import { Wordmark } from "./Wordmark.tsx";

/**
 * The Impressum and the Datenschutzerklärung sit in a row of their own: §5 DDG wants the Impressum
 * easy to find from every page, which a row apart from the section links serves best.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-top">
        <div className="site-footer-brand">
          <Wordmark />
          <p>Eine Hauke Schnau Produktion</p>
        </div>
        <nav aria-label="Fußzeile">
          <ul className="site-footer-links">
            <li>
              <a href={Site.sectionHref(Site.sections.features)}>Funktionen</a>
            </li>
            <li>
              <a href={Site.sectionHref(Site.sections.privacy)}>Verschlüsselung</a>
            </li>
            <li>
              <a href={Site.sectionHref(Site.sections.schools)}>Für Schulen</a>
            </li>
            <li>
              <a href={Site.schoolEnquiry}>Kontakt</a>
            </li>
          </ul>
        </nav>
      </div>
      <nav aria-label="Rechtliches" className="container site-footer-legal">
        <ul className="site-footer-links">
          <li>
            <a href="/impressum">Impressum</a>
          </li>
          <li>
            <a href="/datenschutz">Datenschutz</a>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
