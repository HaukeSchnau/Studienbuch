import { cache } from "react";
import { headers } from "next/headers";
import { Logger } from "next-axiom";

import { createCaller, createTRPCContext } from "@schnau/api";
import { getSessionFromHeaders } from "@schnau/auth/src";

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

export const api = createCaller(createContext);
