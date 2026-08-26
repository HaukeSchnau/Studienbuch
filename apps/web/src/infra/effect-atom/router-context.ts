import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

/** Infrastructure shared by TanStack Router loaders and the React atom provider. */
export interface RouterContext {
  readonly atomRegistry: AtomRegistry.AtomRegistry;
}
