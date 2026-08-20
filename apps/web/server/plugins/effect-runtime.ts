import { definePlugin } from "nitro";
import {
  disposeApplicationRuntime,
  warmApplicationRuntime,
} from "../../src/server-runtime/lifecycle.server.ts";
import { installNodeShutdownHandlers } from "../../src/server-runtime/shutdown.server.ts";

export default definePlugin((nitroApp) => {
  const removeNodeHandlers = installNodeShutdownHandlers();
  nitroApp.hooks.hook("close", async () => {
    removeNodeHandlers();
    await disposeApplicationRuntime();
  });
  void warmApplicationRuntime().then((state) => {
    if (state.status !== "failed") return;
    console.error("Application runtime failed to start", state.reason);
    process.exitCode = 1;
    setImmediate(() => process.kill(process.pid, "SIGTERM"));
  });
});
