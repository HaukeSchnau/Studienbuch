import type { AppRouter } from "@stu/api";
import { createCaller, createTRPCContext } from "@stu/api";
import { getSessionTokenFromHeaders } from "@stu/lib-server";
import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { headers } from "next/headers";
import { Logger } from "next-axiom";

import { createQueryClient } from "./query-client";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = async () => {
  "use cache";
  const heads = await headers();
  const log = new Logger();

  return createTRPCContext({
    source: "rsc",
    sessionToken: getSessionTokenFromHeaders(heads),
    log: log.with({
      source: "rsc",
    }),
  });
};

// eslint-disable-next-line @typescript-eslint/require-await
const getQueryClient = async () => {
  "use cache";
  return createQueryClient();
};
const caller = createCaller(createContext);

export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(caller, getQueryClient);
