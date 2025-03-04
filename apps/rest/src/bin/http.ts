import { serve } from "@hono/node-server";

import { makeRestApi } from "..";
import { env } from "../env";

const port = env.API_PORT;
const { app } = makeRestApi("/");

console.log(`Starting server on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
