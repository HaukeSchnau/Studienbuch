import { serve } from "@hono/node-server";

import { createBase } from "../src/base";
import { env } from "../env";

const port = env.API_PORT;
const app = createBase("/");

process.on("SIGINT", () => {
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on port ${info.port}`);
  },
);
