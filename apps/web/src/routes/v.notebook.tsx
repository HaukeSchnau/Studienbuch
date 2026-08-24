import { createFileRoute } from "@tanstack/react-router";

import { NotebookLanding, landingHead } from "#/features/marketing/index.ts";

/** Landing-page variant C, for side-by-side review. See `src/routes/index.tsx`. */
export const Route = createFileRoute("/v/notebook")({
  component: NotebookLanding,
  head: () => landingHead({ indexable: false }),
});
