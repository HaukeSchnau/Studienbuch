import { createFileRoute } from "@tanstack/react-router";

import { Datenschutz } from "#/features/legal";

export const Route = createFileRoute("/_public/datenschutz")({
  component: Datenschutz,
  head: () => ({
    meta: [{ title: "Datenschutzerklärung — Studienbuch" }, { name: "robots", content: "noindex" }],
  }),
});
