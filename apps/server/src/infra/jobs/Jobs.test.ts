import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { Jobs } from "./Jobs.ts";

const enabled = (env: Record<string, string>) =>
  Jobs.enabled.pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env })),
  );

describe("Jobs.enabled", () => {
  it.effect("reads STUDIENBUCH_JOBS, and runs every job when it is unset", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* enabled({}), ["heartbeat"]);
      assert.deepStrictEqual(yield* enabled({ STUDIENBUCH_JOBS: "none" }), []);
      assert.deepStrictEqual(yield* enabled({ STUDIENBUCH_JOBS: "heartbeat" }), ["heartbeat"]);
    }),
  );

  it.effect("refuses a job it doesn't know, instead of silently running fewer", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(enabled({ STUDIENBUCH_JOBS: "heartbeat,heartbeet" }));
      assert.include(error.cause.message, '["STUDIENBUCH_JOBS"][1]');
    }),
  );
});
