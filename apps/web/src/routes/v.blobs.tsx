import { createFileRoute } from "@tanstack/react-router";

import { BlobsLanding, landingHead } from "#/features/marketing/index.ts";

/** Landing-page variant A, for side-by-side review. See `src/routes/index.tsx`. */
export const Route = createFileRoute("/v/blobs")({
  component: BlobsLanding,
  head: () => landingHead({ indexable: false }),
});
