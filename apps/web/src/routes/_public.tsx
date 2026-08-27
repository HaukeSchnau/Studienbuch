import { Outlet, createFileRoute, getRouteApi } from "@tanstack/react-router";

import { SiteFooter } from "#/domain-ui/site-footer.tsx";
import { SiteHeader } from "#/domain-ui/site-header.tsx";

export const Route = createFileRoute("/_public")({ component: PublicLayout });
const rootRoute = getRouteApi("__root__");

/**
 * Chrome shared by every public-facing page. The decorative blobs are not here: each section places
 * its own, because a section with a background of its own would otherwise paint straight over a
 * page-level layer.
 */
function PublicLayout() {
  const { hasSessionCookie } = rootRoute.useLoaderData();

  return (
    // `public-page` is what `styles.css` looks for to give the document the marketing page's
    // anchor-scrolling behaviour, which the application must not inherit.
    <div className="public-page flex min-h-screen flex-col overflow-x-clip">
      <SiteHeader hasSessionCookie={hasSessionCookie} />
      <main className="grow">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
