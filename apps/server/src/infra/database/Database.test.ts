import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { Database } from "./Database.ts";

const connections = (env: Record<string, string>) =>
  Effect.exit(
    Database.connections.pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env })),
    ),
  );

describe("Database.connections", () => {
  it.effect("keeps serve, Better Auth, prepare and a console within the role's limit", () =>
    Effect.gen(function* () {
      for (const [env, total] of [
        [{ DATABASE_CONNECTIONS: "10" }, 10],
        [{}, 40],
      ] as const) {
        const pools = yield* Effect.flatten(connections(env));

        assert.strictEqual(pools.serve + pools.auth + 2 * pools.command, total);
        assert.isAtLeast(pools.serve, 3);
      }
    }),
  );

  it.effect("refuses a limit that leaves serve no connection beside the two it holds", () =>
    Effect.gen(function* () {
      assert.isTrue(Exit.isFailure(yield* connections({ DATABASE_CONNECTIONS: "8" })));
      assert.isTrue(Exit.isSuccess(yield* connections({ DATABASE_CONNECTIONS: "9" })));
    }),
  );
});
