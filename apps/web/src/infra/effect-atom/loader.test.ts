import { describe, expect, it, vi } from "vite-plus/test";
import * as Effect from "effect/Effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { getAtomResult } from "./loader.ts";

describe("Router atom integration", () => {
  it("keeps each router registry isolated", () => {
    const count = Atom.make(0);
    const first = AtomRegistry.make();
    const second = AtomRegistry.make();

    first.set(count, 1);

    expect(first.get(count)).toBe(1);
    expect(second.get(count)).toBe(0);
    first.dispose();
    second.dispose();
  });

  it("interrupts route data acquisition when navigation is aborted", async () => {
    const finalized = vi.fn();
    const pending = Atom.make(
      Effect.never.pipe(
        Effect.ensuring(
          Effect.sync(() => {
            finalized();
          }),
        ),
      ),
    );
    const registry = AtomRegistry.make();
    const abortController = new AbortController();
    const acquisition = getAtomResult(registry, pending, abortController.signal);

    abortController.abort();

    await expect(acquisition).rejects.toBeDefined();
    await vi.waitFor(() => expect(finalized).toHaveBeenCalledOnce());
    registry.dispose();
  });

  it("deduplicates concurrent preparation of the same atom", async () => {
    let reads = 0;
    const query = Atom.make(
      Effect.sleep("10 millis").pipe(
        Effect.andThen(
          Effect.sync(() => {
            reads += 1;
            return reads;
          }),
        ),
      ),
    );
    const registry = AtomRegistry.make();

    const values = await Promise.all([
      getAtomResult(registry, query, new AbortController().signal),
      getAtomResult(registry, query, new AbortController().signal),
    ]);

    expect(values).toEqual([1, 1]);
    expect(reads).toBe(1);
    registry.dispose();
  });
});
