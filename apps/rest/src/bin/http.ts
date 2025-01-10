import { serve } from "@hono/node-server";

import { makeRestApi } from "..";
import { env } from "../env";

const port = env.API_PORT;
const { app } = makeRestApi("/");

console.log(`Starting server on port ${port}`);

const server = serve({
  fetch: app.fetch,
  port,
});

process.on("SIGINT", () => {
  server.close();
  console.log("SIGINT received, shutting down server");
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.close();
  console.log("SIGTERM received, shutting down server");
  process.exit(0);
});
