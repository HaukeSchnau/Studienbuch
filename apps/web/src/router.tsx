import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen.ts";

// Start's router entry. Start calls it once per prerendered page and once in the browser.
export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
