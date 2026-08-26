import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import type { RouterContext } from "#/infra/effect-atom/router-context.ts";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const atomRegistry = AtomRegistry.make({ defaultIdleTTL: 300_000 });

  return createTanStackRouter({
    routeTree,
    context: { atomRegistry } satisfies RouterContext,
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
