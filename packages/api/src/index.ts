import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";
import { SYSTEM_USER } from "./constants";
import { appRouter } from "./root";
import { ingest } from "./router/events/router";
import { createCallerFactory, createTRPCContext } from "./trpc";

const createCaller = createCallerFactory(appRouter);

type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

export { createTRPCContext, appRouter, createCaller, ingest, SYSTEM_USER };
export type { AppRouter, RouterInputs, RouterOutputs };
