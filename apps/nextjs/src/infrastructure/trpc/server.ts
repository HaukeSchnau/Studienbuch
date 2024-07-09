import { cache } from "react";
import { headers } from "next/headers";
import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { Logger } from "next-axiom";

import type { AppRouter } from "@schnau/api";
import { createCaller, createTRPCContext } from "@schnau/api";
import { getSessionFromHeaders } from "@schnau/auth/src";

import { createQueryClient } from "./query-client";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = headers();
  const log = new Logger();

  return createTRPCContext({
    source: "rsc",
    session: await getSessionFromHeaders(heads),
    log: log.with({
      source: "rsc",
    }),
  });
});

const getQueryClient = cache(createQueryClient);
const caller = createCaller(createContext);

export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient,
);
