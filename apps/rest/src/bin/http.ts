import { serve } from "@hono/node-server";

import { createCaller } from "@stu/api";

import { makeRestApi } from "..";
import { env } from "../env";

const port = env.API_PORT;
const { app } = makeRestApi("/");

const caller = createCaller({
  log: {
    info: console.log,
    flush: async () => {},
  } as any,
  session: null,
});

serve({
  fetch: app.fetch,
  port,
});
