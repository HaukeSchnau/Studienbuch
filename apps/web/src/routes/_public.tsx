import { Outlet, createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "#/domain-ui/site-footer.tsx";
import { SiteHeader } from "#/domain-ui/site-header.tsx";

export const Route = createFileRoute("/_public")({ component: PublicLayout });

/** Chrome shared by every public-facing page: the floating nav and the footer. */
function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="grow">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
