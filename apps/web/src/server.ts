import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { warmApplicationRuntime } from "./server-runtime/lifecycle.server.ts";

export default createServerEntry({
  async fetch(...args) {
    const state = await warmApplicationRuntime();
    if (state.status !== "ready") {
      return new Response("Application runtime unavailable", { status: 503 });
    }
    return handler.fetch(...args);
  },
});
