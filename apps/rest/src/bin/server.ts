import type { Serve } from "bun";

import { makeRestApi } from "../index";

const { app } = makeRestApi("/");

export default {
  fetch: app.fetch,
} satisfies Serve;
