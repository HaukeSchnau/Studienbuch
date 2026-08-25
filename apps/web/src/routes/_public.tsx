import { Outlet, createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "#/domain-ui/site-footer.tsx";
import { SiteHeader } from "#/domain-ui/site-header.tsx";

export const Route = createFileRoute("/_public")({ component: PublicLayout });

/**
 * Chrome shared by every public-facing page. The decorative blobs are not here: each section places
 * its own, because a section with a background of its own would otherwise paint straight over a
 * page-level layer.
 */
function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <SiteHeader />
      <main className="grow">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
