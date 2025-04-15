import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { SYSTEM_USER } from "./constants";
import type { AppRouter } from "./root";
import { appRouter } from "./root";
import { ingest } from "./router/events/ingest";
import { subscribe } from "./router/events/messaging-client";
import { createCallerFactory, createTRPCContext, getSession } from "./trpc";

const createCaller = createCallerFactory(appRouter);

type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

export {
  createTRPCContext,
  appRouter,
  createCaller,
  ingest,
  subscribe,
  SYSTEM_USER,
  getSession,
};
export type { AppRouter, RouterInputs, RouterOutputs };
