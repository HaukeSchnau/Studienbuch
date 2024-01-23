import { createTRPCProxyClient, httpBatchLink, loggerLink } from "@trpc/client";
import fetch from "cross-fetch";
import superjson from "superjson";

import type { AppRouter } from "@schnau/api";

export { isHolidayToday } from "@schnau/common";

const BASE_URL = "https://studienbuch.haukeschnau.de";

export const createClient = () =>
  createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
      }),
      httpBatchLink({
        fetch,
        url: `${BASE_URL}/api/trpc`,
      }),
    ],
  });
