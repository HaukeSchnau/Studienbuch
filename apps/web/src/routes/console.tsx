import { createFileRoute } from "@tanstack/react-router";

import { Wordmark } from "#/domain-ui/Wordmark.tsx";
import consoleCss from "#/features/system/console.css?url";
import { ServerRevision } from "#/features/system/ServerRevision.tsx";

// Served from the SPA shell (`spa.maskPath` in vite.config.ts) and never prerendered.
export const Route = createFileRoute("/console")({
  head: () => ({
    meta: [{ title: "Konsole · Studienbuch" }],
    links: [{ rel: "stylesheet", href: consoleCss }],
  }),
  component: Console,
});

function Console() {
  return (
    <div className="console">
      <header className="console-header">
        <Wordmark />
        <span className="console-badge">Operator</span>
      </header>
      <main className="console-main">
        <h1>Konsole</h1>
        <ServerRevision />
      </main>
    </div>
  );
}
