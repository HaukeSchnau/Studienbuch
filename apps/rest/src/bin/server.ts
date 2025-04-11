import type { Serve } from "bun";

import { makeRestApi } from "../index";

const { app } = makeRestApi("/");

process.on("SIGINT", () => {
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});

export default {
  fetch: app.fetch,
} satisfies Serve;
