import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";

it("runs an Effect by hand", async () => {
  // oxlint-disable-next-line studienbuch/no-manual-effect-runtime-in-tests -- fixture: Effect.runPromise in a test
  await Effect.runPromise(Effect.void);
});

it("builds a runtime by hand", async () => {
  // oxlint-disable-next-line studienbuch/no-manual-effect-runtime-in-tests -- fixture: ManagedRuntime.make in a test
  const runtime = ManagedRuntime.make(Layer.empty);

  await runtime.dispose();
});

it.effect("runs under @effect/vitest", () => Effect.void);
