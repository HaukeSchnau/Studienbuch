import { createFileRoute } from "@tanstack/react-router";

import { ServerRevision } from "#/features/system/ServerRevision.tsx";

// Served from the SPA shell (`spa.maskPath` in vite.config.ts) and never prerendered.
export const Route = createFileRoute("/console")({
  head: () => ({ meta: [{ title: "Konsole · Studienbuch" }] }),
  component: Console,
});

function Console() {
  return (
    <main className="column content">
      <h1>Konsole</h1>
      <ServerRevision />
    </main>
  );
}
