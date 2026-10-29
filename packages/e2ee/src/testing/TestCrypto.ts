/**
 * The real primitives with reproducible randomness, for tests and the vectors. Production code never
 * imports `@stu/e2ee/testing` (lint rule `studienbuch/test-only-imports`).
 */
import { Primitives } from "../suite/Primitives.ts";
import { RandomStream } from "./RandomStream.ts";

export * as TestCrypto from "./TestCrypto.ts";

/** The platform's WebCrypto, drawing the stream `RandomStream.seeded` names. */
export const layer = (seed: string) => RandomStream.seeded(Primitives.make, seed);

/** The platform's WebCrypto, drawing exactly `randomness`. */
export const layerFixed = (randomness: Uint8Array) =>
  RandomStream.fixed(Primitives.make, randomness);
