import type { RuntimeLifecycle } from "./lifecycle.server.ts";
import { applicationRuntimeLifecycle } from "./lifecycle.server.ts";

const shutdownHandlerKey = Symbol.for("@stu/web/application-runtime-shutdown-handlers");
const globalHandlers = globalThis as typeof globalThis & {
  [shutdownHandlerKey]?: () => void;
};

export function installNodeShutdownHandlers(
  lifecycle: Pick<RuntimeLifecycle, "dispose"> = applicationRuntimeLifecycle,
): () => void {
  globalHandlers[shutdownHandlerKey]?.();

  const handleSignal = () => {
    void lifecycle.dispose().catch((cause: unknown) => {
      console.error("Failed to dispose the Studienbuch application runtime", cause);
    });
  };
  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  const remove = () => {
    process.removeListener("SIGINT", handleSignal);
    process.removeListener("SIGTERM", handleSignal);
    if (globalHandlers[shutdownHandlerKey] === remove) {
      delete globalHandlers[shutdownHandlerKey];
    }
  };
  globalHandlers[shutdownHandlerKey] = remove;
  return remove;
}
