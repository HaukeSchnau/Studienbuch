import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import { CapturedMail } from "#/features/mail/CapturedMail.tsx";
import { Wordmark } from "#/domain-ui/Wordmark.tsx";
import consoleCss from "#/features/system/console.css?url";
import { ServerRevision } from "#/features/system/ServerRevision.tsx";

// Served from the SPA shell (`spa.maskPath` in vite.config.ts), which holds an empty Suspense here.
// Start drops `ssr` from client routes, so the router's first load would swap that boundary for the
// page before React hydrates it: a mismatch. `wrapInSuspense` and `ClientOnly` keep the first
// render the same as the shell; drop both once Start keeps the shell's boundary for loaded matches.
export const Route = createFileRoute("/console")({
  wrapInSuspense: true,
  head: () => ({
    meta: [{ title: "Konsole · Studienbuch" }],
    links: [{ rel: "stylesheet", href: consoleCss }],
  }),
  component: Console,
});

function Console() {
  return (
    <ClientOnly>
      <ConsolePage />
    </ClientOnly>
  );
}

function ConsolePage() {
  return (
    <div className="console">
      <header className="console-header">
        <Wordmark />
        <span className="console-badge">Operator</span>
      </header>
      <main className="console-main">
        <h1>Konsole</h1>
        <ServerRevision />
        <CapturedMail />
      </main>
    </div>
  );
}
