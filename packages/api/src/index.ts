import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";
import { SYSTEM_USER } from "./constants";
import {
  ensureStream,
  RabbitMQClient,
  rabbitMqClientPromise,
} from "./rabbitmq";
import { appRouter } from "./root";
import { ingest } from "./router/events/ingest";
import { createCallerFactory, createTRPCContext, getSession } from "./trpc";

const createCaller = createCallerFactory(appRouter);

type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

export {
  createTRPCContext,
  appRouter,
  createCaller,
  ingest,
  SYSTEM_USER,
  ensureStream,
  rabbitMqClientPromise,
  getSession,
};
export type { AppRouter, RouterInputs, RouterOutputs, RabbitMQClient };
