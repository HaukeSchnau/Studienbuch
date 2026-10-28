import { createFileRoute } from "@tanstack/react-router";

import { Impressum } from "#/features/legal/Impressum.tsx";
import legalCss from "#/features/legal/legal.css?url";

export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [{ title: "Impressum · Studienbuch" }],
    links: [{ rel: "stylesheet", href: legalCss }],
  }),
  component: Impressum,
});
