import type { Serve } from "bun";

import { createBase } from "../src/base";

const app = createBase("/");

process.on("SIGINT", () => {
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});

export default {
  fetch: app.fetch,
} satisfies Serve;
