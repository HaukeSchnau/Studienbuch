import { createFileRoute } from "@tanstack/react-router";

import { SwooshLanding, landingHead } from "#/features/marketing/index.ts";

/**
 * The landing page. Three design variants are in review at `/v/blobs`, `/v/swoosh` and
 * `/v/notebook`; this points at whichever one is currently favoured.
 * TODO: once a variant is chosen, inline it here and delete the other two along with their routes.
 */
export const Route = createFileRoute("/")({
  component: SwooshLanding,
  head: () => landingHead(),
});
