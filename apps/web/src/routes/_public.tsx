import { Outlet, createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "#/domain-ui/site-footer.tsx";
import { SiteHeader } from "#/domain-ui/site-header.tsx";
import { PageDecor } from "#/features/marketing/decor.tsx";

export const Route = createFileRoute("/_public")({ component: PublicLayout });

/** Chrome shared by every public-facing page: the corner blobs, the nav and the footer. */
function PublicLayout() {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-clip">
      <PageDecor />
      <SiteHeader />
      <main className="grow">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
