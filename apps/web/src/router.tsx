import { createRouter } from "@tanstack/react-router";

import { SiteFooter } from "#/domain-ui/SiteFooter.tsx";
import { SiteHeader } from "#/domain-ui/SiteHeader.tsx";

import { routeTree } from "./routeTree.gen.ts";

// Start's router entry. Start calls it once per prerendered page and once in the browser.
export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true, defaultNotFoundComponent: NotFound });
}

/**
 * A path no route matches. In a release build that is a path under /console, because the server
 * answers other unknown paths with its own 404 (WebBuilds.ts).
 */
function NotFound() {
  return (
    <div className="public-page">
      <SiteHeader />
      <main className="section">
        <div className="container section-heading">
          <h1 style={{ color: "var(--color-accent)" }}>Seite nicht gefunden</h1>
          <p>
            Diese Adresse gibt es bei Studienbuch nicht. Vielleicht hat sich ein Tippfehler
            eingeschlichen, oder der Link ist veraltet.
          </p>
          <a className="button button-accent press" href="/" style={{ alignSelf: "flex-start" }}>
            Zur Startseite
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
