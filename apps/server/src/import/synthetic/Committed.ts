/**
 * The synthetic school CI measures: the committed calibration and one seed. `import:eval --corpus
 * synthetic` evaluates it against its numbers in `baseline.json`.
 */
import * as Effect from "effect/Effect";
import { Calibration } from "./Calibration.ts";
import calibrationJson from "./calibration.json" with { type: "json" };
import { SyntheticSchool } from "./SyntheticSchool.ts";

export * as Committed from "./Committed.ts";

export const seed = 1;

export const calibration = Calibration.decodeValue(calibrationJson);

export const school = Effect.gen(function* () {
  return yield* SyntheticSchool.generate(yield* calibration, seed);
});
