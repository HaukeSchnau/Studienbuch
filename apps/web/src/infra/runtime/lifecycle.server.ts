import { flushOtlp } from "@stu/observability/server";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { WebApplicationLive } from "./layer.server.ts";

export type RuntimeState =
  | { readonly status: "starting" }
  | { readonly status: "ready" }
  | { readonly status: "failed"; readonly reason: string }
  | { readonly status: "stopping" }
  | { readonly status: "stopped" };

export interface RuntimeLifecycle {
  readonly runtime: ReturnType<typeof createManagedRuntime>;
  readonly warm: () => Promise<RuntimeState>;
  readonly dispose: () => Promise<void>;
  readonly state: () => RuntimeState;
}

export interface LifecycleController {
  readonly warm: () => Promise<RuntimeState>;
  readonly dispose: () => Promise<void>;
  readonly state: () => RuntimeState;
}

function createManagedRuntime() {
  return ManagedRuntime.make(WebApplicationLive);
}

export function createLifecycleController(actions: {
  readonly warm: () => Promise<
    { readonly success: true } | { readonly success: false; readonly reason: string }
  >;
  readonly flush: () => Promise<void>;
  readonly dispose: () => Promise<void>;
}): LifecycleController {
  let currentState: RuntimeState = { status: "starting" };
  let warmup: Promise<RuntimeState> | undefined;
  let shutdown: Promise<void> | undefined;
  let warmed = false;

  const warm = async () => {
    if (shutdown !== undefined) return currentState;
    warmup ??= actions.warm().then((result): RuntimeState => {
      if (result.success) {
        warmed = true;
        return (currentState = { status: "ready" });
      }
      return (currentState = { status: "failed", reason: result.reason });
    });
    return warmup;
  };

  const dispose = () => {
    shutdown ??= (async () => {
      currentState = { status: "stopping" };
      try {
        if (warmup !== undefined) {
          await warmup;
          if (warmed) await actions.flush();
        }
      } finally {
        await actions.dispose();
        currentState = { status: "stopped" };
      }
    })();
    return shutdown;
  };

  return { warm, dispose, state: () => currentState };
}

export function createRuntimeLifecycle(): RuntimeLifecycle {
  const runtime = createManagedRuntime();
  const controller = createLifecycleController({
    warm: () =>
      runtime.context().then(
        () => ({ success: true as const }),
        (cause: unknown) => ({
          success: false as const,
          reason: cause instanceof Error ? cause.message : String(cause),
        }),
      ),
    flush: () =>
      runtime.runPromise(flushOtlp.pipe(Effect.timeoutOption(Duration.seconds(3)), Effect.asVoid)),
    dispose: runtime.dispose,
  });
  return { runtime, ...controller };
}

const lifecycleKey = Symbol.for("@stu/web/application-runtime-lifecycle");
const globalRuntime = globalThis as typeof globalThis & {
  [lifecycleKey]?: RuntimeLifecycle;
};

export const applicationRuntimeLifecycle =
  globalRuntime[lifecycleKey] ?? (globalRuntime[lifecycleKey] = createRuntimeLifecycle());

export const applicationRuntime = applicationRuntimeLifecycle.runtime;
export const warmApplicationRuntime = applicationRuntimeLifecycle.warm;
export const disposeApplicationRuntime = applicationRuntimeLifecycle.dispose;
export const applicationRuntimeState = applicationRuntimeLifecycle.state;
