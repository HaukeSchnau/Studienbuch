import { createFileRoute } from "@tanstack/react-router";

import { ServerRevision } from "#/features/system/ServerRevision.tsx";
import { SiteFooter } from "#/ui/SiteFooter.tsx";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <>
      <header className="hero">
        <div className="column">
          <h1>Studienbuch</h1>
          <p>Stundenplan, Vertretungen, Hausaufgaben und Noten. Auch offline.</p>
        </div>
      </header>
      <main className="column content">
        <ServerRevision />
      </main>
      <SiteFooter />
    </>
  );
}
