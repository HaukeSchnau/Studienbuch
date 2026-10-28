import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "#/features/legal/LegalPage.tsx";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({ meta: [{ title: "Datenschutz · Studienbuch" }] }),
  component: () => (
    <LegalPage title="Datenschutz">
      <p>Die Datenschutzerklärung folgt.</p>
    </LegalPage>
  ),
});
