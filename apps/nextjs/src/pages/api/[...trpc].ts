import { createOpenApiNextHandler } from "trpc-openapi";

import { appRouter, createTRPCContext } from "@acme/api";

export default createOpenApiNextHandler({
  router: appRouter,
  createContext: createTRPCContext,
});
