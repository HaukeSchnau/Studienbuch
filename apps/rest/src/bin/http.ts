import { serve } from "@hono/node-server";

import { makeRestApi } from "..";
import { env } from "../env";

const port = env.API_PORT;
const { app } = makeRestApi("/");

serve({
  fetch: app.fetch,
  port,
});
