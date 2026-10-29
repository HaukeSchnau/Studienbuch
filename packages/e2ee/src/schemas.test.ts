import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { rolldown } from "vite/rolldown";

const entry = decodeURIComponent(new URL("schemas.ts", import.meta.url).pathname);

/** Every module the entry imports, directly or not, whether or not a bundle keeps its code. */
const reachable = Effect.gen(function* () {
  let ids: ReadonlyArray<string> = [];

  yield* Effect.acquireUseRelease(
    Effect.promise(() =>
      rolldown({
        input: entry,
        external: [/^effect(\/|$)/u],
        plugins: [
          {
            name: "module-graph",
            buildEnd() {
              ids = [...this.getModuleIds()];
            },
          },
        ],
      }),
    ),
    (build) => Effect.promise(() => build.generate({ format: "esm" })),
    (build) => Effect.promise(() => build.close()),
  );

  return ids;
});

describe("@stu/e2ee/schemas", () => {
  it.effect("reaches neither noble nor the CryptoSuite, so the console bundles no crypto", () =>
    Effect.gen(function* () {
      const ids = yield* reachable;

      expect(ids).toContain(entry);
      expect(ids.filter((id) => id.includes("/@noble/") || id.includes("/src/suite/"))).toEqual([]);
    }),
  );
});
