import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { LoadingState } from "#/domain-ui/brand/loading-state.tsx";
import type { RouterContext } from "#/infra/effect-atom/router-context.ts";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const atomRegistry = AtomRegistry.make({ defaultIdleTTL: 300_000 });

  return createTanStackRouter({
    routeTree,
    context: { atomRegistry } satisfies RouterContext,
    scrollRestoration: true,
    defaultPreload: "intent",
    // Without this the framework renders nothing while a route resolves, so `/app` waiting on the
    // account looked like a white page rather than like a product starting up.
    defaultPendingComponent: LoadingState,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
