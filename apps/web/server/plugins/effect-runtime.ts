import { definePlugin } from "nitro";
import {
  disposeApplicationRuntime,
  warmApplicationRuntime,
} from "../../src/infra/runtime/lifecycle.server.ts";
import {
  applicationRpcEndpoint,
  disposeApplicationRpcEndpoint,
} from "../../src/infra/rpc/endpoint.server.ts";
import { installNodeShutdownHandlers } from "../../src/infra/runtime/shutdown.server.ts";

const terminateAfterStartupFailure = (reason: string) => {
  console.error("Application runtime failed to start", reason);
  process.exitCode = 1;
  setImmediate(() => process.kill(process.pid, "SIGTERM"));
};

export default definePlugin((nitroApp) => {
  const removeNodeHandlers = installNodeShutdownHandlers();
  nitroApp.hooks.hook("close", async () => {
    removeNodeHandlers();
    await disposeApplicationRpcEndpoint();
    await disposeApplicationRuntime();
  });
  void Promise.all([warmApplicationRuntime(), applicationRpcEndpoint()]).then(
    ([state]) => {
      if (state.status === "failed") terminateAfterStartupFailure(state.reason);
    },
    (cause: unknown) =>
      terminateAfterStartupFailure(cause instanceof Error ? cause.message : String(cause)),
  );
});
