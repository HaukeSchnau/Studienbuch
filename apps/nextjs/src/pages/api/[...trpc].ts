import type { NextApiRequest, NextApiResponse } from "next";
import { log } from "next-axiom";
import { createOpenApiNextHandler } from "trpc-openapi";

import { appRouter, createTRPCContext } from "@schnau/api";

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;

    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v);
      }
    } else {
      headers.append(key, value);
    }
  }

  if (!headers.has("x-trpc-source")) headers.set("x-trpc-source", "REST API");

  const context = createTRPCContext({
    headers,
    log: log.with({
      trpc: {
        source: "REST API",
      },
    }),
  });

  return createOpenApiNextHandler({
    router: appRouter,
    createContext: () => context,
    onError: () => {
      console.error("TRPC error");
    },
    responseMeta: () => ({
      headers: {
        "x-powered-by": "Schnau",
      },
    }),
  })(req, res);
};

export default handler;
