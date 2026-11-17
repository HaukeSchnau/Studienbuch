import type { Boundary } from "./boundary.ts";

export const everywhere: ReadonlyArray<Boundary> = [
  {
    files: ["**"],
    forbidden: ["temporal-polyfill", "temporal-polyfill/global{,/**}", "@js-temporal/**"],
    reason:
      "Civil time uses the functional API of temporal-polyfill/fns; the global shim mutates the runtime (ADR 0001).",
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    forbidden: ["vitest"],
    reason: "Tests import from @effect/vitest, which re-exports Vitest with Effect support.",
  },
];
