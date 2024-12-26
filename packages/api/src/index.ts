import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";
import { appRouter } from "./root";
import { ingest } from "./router/events/router";
import { createCallerFactory, createTRPCContext } from "./trpc";

const createCaller = createCallerFactory(appRouter);

type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

export { createTRPCContext, appRouter, createCaller, ingest };
export type { AppRouter, RouterInputs, RouterOutputs };
