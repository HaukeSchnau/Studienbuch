import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "#/features/legal/LegalPage.tsx";

export const Route = createFileRoute("/impressum")({
  head: () => ({ meta: [{ title: "Impressum · Studienbuch" }] }),
  component: () => (
    <LegalPage title="Impressum">
      <p>Das Impressum folgt.</p>
    </LegalPage>
  ),
});
