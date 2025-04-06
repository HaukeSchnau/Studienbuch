import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { RabbitMQClient } from "./rabbitmq";
import type { AppRouter } from "./root";
import { SYSTEM_USER } from "./constants";
import { appRouter } from "./root";
import { ingest } from "./router/events/ingest";
import { subscribe } from "./router/events/subscribe";
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
export type { AppRouter, RouterInputs, RouterOutputs, RabbitMQClient };
