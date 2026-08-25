import { createFileRoute } from "@tanstack/react-router";

import { Impressum } from "#/features/legal";

export const Route = createFileRoute("/_public/impressum")({
  component: Impressum,
  head: () => ({
    meta: [{ title: "Impressum — Studienbuch" }, { name: "robots", content: "noindex" }],
  }),
});
