import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { warmApplicationRuntime } from "./server-runtime/lifecycle.server.ts";

export default createServerEntry({
  async fetch(...args) {
    await warmApplicationRuntime();
    return handler.fetch(...args);
  },
});
