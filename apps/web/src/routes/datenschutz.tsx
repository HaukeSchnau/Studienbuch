import { createFileRoute } from "@tanstack/react-router";

import { Datenschutz } from "#/features/legal/Datenschutz.tsx";
import legalCss from "#/features/legal/legal.css?url";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({
    meta: [{ title: "Datenschutzerklärung · Studienbuch" }],
    links: [{ rel: "stylesheet", href: legalCss }],
  }),
  component: Datenschutz,
});
