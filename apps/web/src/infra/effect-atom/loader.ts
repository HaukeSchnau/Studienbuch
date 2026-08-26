import * as Effect from "effect/Effect";
import { AtomRegistry, type AsyncResult, type Atom } from "effect/unstable/reactivity";

/** Waits for route-critical atom data and binds Router cancellation to Effect interruption. */
export const getAtomResult = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  signal: AbortSignal,
) =>
  Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }), { signal });
