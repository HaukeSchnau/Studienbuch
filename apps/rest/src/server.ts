import { serve } from "@hono/node-server";

import { makeRestApi } from ".";
import { env } from "./env";

const { app } = makeRestApi("/");

const port = env.PORT;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
