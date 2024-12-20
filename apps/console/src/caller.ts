import { createCaller, createTRPCContext } from "@stu/api";

import { logger } from "./logger";

export const api = createCaller(
  await createTRPCContext({
    source: "console",
    log: logger,
    authority: "console",
  }),
);
