import type { NextApiRequest, NextApiResponse } from "next";
import { createOpenApiNextHandler } from "trpc-openapi";

import { appRouter, createTRPCContext } from "@schnau/api";

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  const context = createTRPCContext({
    headers: req.headers,
    session: null,
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
