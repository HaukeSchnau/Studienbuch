# Previews on srv-2, deployed before checks finish

Status: accepted 2026-10-28 ([D33](https://files.schnau.dev/html/studienbuch-roadmap/#D33), [D35](https://files.schnau.dev/html/studienbuch-roadmap/#D35), [D36](https://files.schnau.dev/html/studienbuch-roadmap/#D36))

Every PR from a branch of this repository gets a preview: the release bundle as its own `Fleet.Service` at `pr-<n>.studienbuch.schnau.dev` on the Tailnet, with its own database and the demo school. It deploys as soon as the bundle exists, and the checks report into the same PR comment while it runs. Beta still waits for every check. Previews run on srv-2 next to beta, at most three at a time with 512 MB each, and closing the PR removes the preview.

Hauke verifies only through previews and beta, so preview latency is his feedback loop. The targets: 2.5 minutes from push to a ready preview for a typical change (4 minutes at p90), 1 minute after `calder check`, 10 minutes without cache. Previews move to the tower once its routes can wake it on request.

Reasoning: [hosting.md, previews](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/hosting.md#per-pr-previews-d22-d33) and [preview speed](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/hosting.md#6-preview-speed-is-the-product).
