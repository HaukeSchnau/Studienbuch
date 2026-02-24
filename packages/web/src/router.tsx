import { QueryClient } from "@tanstack/react-query";
import { createRoute, createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { Footer } from "~/components/layout/Footer";
import { Route as RootRoute } from "./routes/__root";

const IndexRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/",
  component: HomePage,
});

const routeTree = RootRoute.addChildren([IndexRoute]);

export const createRouter = () => {
  const queryClient = new QueryClient();
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}

function HomePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-4xl flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Studienbuch Web</h1>
      <p className="text-base text-slate-700">
        TanStack Start scaffold is active. Legacy UI and domain modules from the Next.js app were copied under
        <code> src/</code> and can be routed incrementally.
      </p>
      <Footer />
    </main>
  );
}
