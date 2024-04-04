import { cache } from "react";
import { headers } from "next/headers";
import { Logger } from "next-axiom";

import { createCaller, createTRPCContext } from "@schnau/api";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  const heads = new Headers(headers());
  heads.set("x-trpc-source", "rsc");
  const log = new Logger();

  return createTRPCContext({
    headers: heads,
    log: log.with({
      trpc: {
        source: "rsc",
      },
    }),
  });
});

export const api = createCaller(createContext);
