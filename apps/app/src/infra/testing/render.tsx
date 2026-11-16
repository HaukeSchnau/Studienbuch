import { ExpoRoot, Slot } from "expo-router";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { page, utils, type Locator, type LocatorSelectors } from "vite-plus/test/browser";

// After T3 Code's apps/web/test/render.tsx (MIT, copyright T3 Tools Inc.), with expo-router as the
// test router.

type RouteContext = ComponentProps<typeof ExpoRoot>["context"];

/** Queries are scoped to the container; use `page` for portals such as dialogs. */
export interface Screen extends LocatorSelectors, AsyncDisposable {
  readonly container: HTMLElement;
  readonly locator: Locator;
  /**
   * The pages clicks would have loaded: anchors whose default nothing prevented. The screen
   * prevents it, so the test's frame stays.
   */
  readonly pageLoads: ReadonlyArray<string>;
}

export interface RenderOptions {
  /** The other screens of the test router by path, as `{ anmelden: () => <Text>…</Text> }`. */
  readonly routes?: Readonly<Record<string, ComponentType>>;
}

/** expo-router's view of a directory of routes, as Metro's `require.context` hands it. */
function routeContext(screens: Readonly<Record<string, ComponentType>>): RouteContext {
  const modules = new Map(
    Object.entries(screens).map(([path, screen]) => [`./${path}.tsx`, screen]),
  );

  const load = (id: string) => ({ default: modules.get(id) });

  // SAFETY: `RequireContext` also declares a generic call signature, which only `require` itself
  // satisfies; expo-router reads `default` from what `load` returns.
  return Object.assign(load, {
    keys: () => [...modules.keys()],
    resolve: (id: string) => id,
    id: "0",
  }) as RouteContext;
}

/**
 * Renders `ui` as the app's "/" for one test, under expo-router. Acquire it with `await using` so
 * the tree unmounts, and the frame's address comes back, when the test ends, pass or fail.
 */
export async function render(ui: ReactNode, { routes = {} }: RenderOptions = {}): Promise<Screen> {
  const address = window.location.href;
  const container = document.createElement("div");
  const pageLoads: Array<string> = [];

  document.body.append(container);

  const root = createRoot(container);

  // Registered after React's own listener on the container, so it sees what the handlers did.
  container.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;

    if (anchor === null || event.defaultPrevented) return;

    pageLoads.push(anchor.getAttribute("href") ?? "");
    event.preventDefault();
  });

  root.render(<ExpoRoot context={routeContext({ _layout: Slot, index: () => ui, ...routes })} />);

  return {
    ...utils.getElementLocatorSelectors(container),
    container,
    locator: page.elementLocator(container),
    pageLoads,
    [Symbol.asyncDispose]: async () => {
      root.unmount();
      container.remove();
      window.history.replaceState(null, "", address);
    },
  };
}
