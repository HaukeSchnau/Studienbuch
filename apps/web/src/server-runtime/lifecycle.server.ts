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
  readonly warm: () => Promise<void>;
  readonly dispose: () => Promise<void>;
  readonly state: () => RuntimeState;
}

export interface LifecycleController {
  readonly warm: () => Promise<void>;
  readonly dispose: () => Promise<void>;
  readonly state: () => RuntimeState;
}

function createManagedRuntime() {
  return ManagedRuntime.make(WebApplicationLive);
}

export function createLifecycleController(actions: {
  readonly warm: () => Promise<void>;
  readonly flush: () => Promise<void>;
  readonly dispose: () => Promise<void>;
}): LifecycleController {
  let currentState: RuntimeState = { status: "starting" };
  let warmup: Promise<void> | undefined;
  let shutdown: Promise<void> | undefined;
  let warmed = false;

  const warm = () => {
    if (shutdown !== undefined) {
      return Promise.reject(new Error("The application runtime is stopping or stopped"));
    }
    warmup ??= actions.warm().then(
      () => {
        warmed = true;
        currentState = { status: "ready" };
      },
      (error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        currentState = { status: "failed", reason };
        throw error;
      },
    );
    return warmup;
  };

  const dispose = () => {
    shutdown ??= (async () => {
      currentState = { status: "stopping" };
      try {
        if (warmup !== undefined) {
          await warmup.catch(() => undefined);
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
    warm: () => runtime.context().then(() => undefined),
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
