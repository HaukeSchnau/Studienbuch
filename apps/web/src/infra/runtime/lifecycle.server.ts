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

const lifecycleKey = Symbol.for("@stu/web/application-runtime-lifecycle-v2");
const globalRuntime = globalThis as typeof globalThis & {
  [lifecycleKey]?: RuntimeLifecycle;
};
const processCurrent = globalRuntime[lifecycleKey];
const processCurrentState = processCurrent?.state().status;
const shouldReplaceCurrent =
  processCurrent !== undefined &&
  (processCurrentState === "stopping" ||
    processCurrentState === "stopped" ||
    import.meta.hot?.data.applicationRuntimeLifecycle === processCurrent);

const makeActiveRuntimeLifecycle = (previous?: RuntimeLifecycle): RuntimeLifecycle => {
  const current = createRuntimeLifecycle();
  let activation: Promise<RuntimeState> | undefined;
  return {
    ...current,
    warm: () => {
      activation ??= current.warm().then(async (state) => {
        // Nitro keeps the process alive across server reloads. Build the replacement before closing
        // its predecessor so requests never observe a missing application runtime.
        if (state.status === "ready") await previous?.dispose();
        return state;
      });
      return activation;
    },
  };
};

export const selectRuntimeLifecycle = (
  processCurrent: RuntimeLifecycle | undefined,
  shouldReplaceCurrent: boolean,
) =>
  processCurrent === undefined || shouldReplaceCurrent
    ? makeActiveRuntimeLifecycle(shouldReplaceCurrent ? processCurrent : undefined)
    : processCurrent;

export const applicationRuntimeLifecycle = selectRuntimeLifecycle(
  processCurrent,
  shouldReplaceCurrent,
);

globalRuntime[lifecycleKey] = applicationRuntimeLifecycle;
if (import.meta.hot !== undefined) {
  import.meta.hot.data.applicationRuntimeLifecycle = applicationRuntimeLifecycle;
}

// Server modules can reload without Nitro rerunning its startup plugin. Warm each new generation at
// its source; the plugin awaits the same idempotent operation and remains responsible for failure.
void applicationRuntimeLifecycle.warm();

export const applicationRuntime = applicationRuntimeLifecycle.runtime;
export const warmApplicationRuntime = applicationRuntimeLifecycle.warm;
export const disposeApplicationRuntime = applicationRuntimeLifecycle.dispose;
export const applicationRuntimeState = applicationRuntimeLifecycle.state;
