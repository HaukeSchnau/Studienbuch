import { createFileRoute } from "@tanstack/react-router";

import { SwooshLanding, landingHead } from "#/features/marketing/index.ts";

/** Landing-page variant B, for side-by-side review. See `src/routes/index.tsx`. */
export const Route = createFileRoute("/v/swoosh")({
  component: SwooshLanding,
  head: () => landingHead({ indexable: false }),
});
