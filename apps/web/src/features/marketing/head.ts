import { copy } from "#/features/marketing/copy.ts";

/**
 * Head tags shared by every landing route. The three comparison routes pass `indexable: false` so
 * only the real landing page can ever be crawled.
 */
export const landingHead = ({ indexable = true }: { indexable?: boolean } = {}) => ({
  meta: [
    { title: copy.meta.title },
    { name: "description", content: copy.meta.description },
    ...(indexable ? [] : [{ name: "robots", content: "noindex" }]),
  ],
});
