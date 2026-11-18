import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";
import { NaiveImport } from "../NaiveImport.ts";
import { Baseline } from "./Baseline.ts";
import { Evaluator } from "./Evaluator.ts";
import { TinySchool } from "./TinySchool.ts";

const toJson = Schema.decodeUnknownEffect(Schema.Json);

const measure = (timeline: boolean) =>
  Evaluator.evaluate({
    corpus: TinySchool.corpus,
    corpusName: TinySchool.corpus.manifest.id,
    profile: TinySchool.profile,
    importName: "naive",
    importLayer: NaiveImport.layer,
    weeks: Option.none(),
    timeline,
  }).pipe(Effect.map(Struct.omit(["worst"])));

describe("Baseline", () => {
  it.effect("finds every number that differs, and every number only one side has", () =>
    Effect.gen(function* () {
      const weekly = yield* measure(false);
      const timeline = yield* measure(true);
      const measured: Baseline.Numbers = { corpus: "tiny-school", weekly, timeline };

      const json = yield* Baseline.toJson(measured);

      assert.deepStrictEqual(Baseline.differences(json, json), []);

      // The file was written before a change: one fraction and a case list moved, a number is
      // new, and one the evaluation no longer has is still there.
      const committed = {
        ...measured,
        weekly: {
          ...weekly,
          views: {
            ...weekly.views,
            student: { ...weekly.views.student, recall: { right: 27, of: 28 } },
          },
          passingCases: ["cancellation"],
          retired: 4,
        },
        timeline: Struct.omit(timeline, ["hiddenDays"]),
      };

      assert.deepStrictEqual(Baseline.differences(yield* toJson(committed), json), [
        { number: "weekly.views.student.recall", baseline: "27 of 28", measured: "28 of 28" },
        {
          number: "weekly.passingCases",
          baseline: "cancellation",
          measured: "cancellation, free-day, ma-e-group-kept, room-change, substitution",
        },
        { number: "weekly.retired", baseline: "4", measured: "nothing" },
        { number: "timeline.hiddenDays", baseline: "nothing", measured: "0" },
      ]);
    }),
  );
});
