import type { AppRouter } from "@stu/api";
import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createWSClient, loggerLink, wsLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import { clientRouter } from "~/db/local-trpc";
import { getBaseUrl } from "./base-url";
import { PersistingQueryClient } from "./local-trpc/persisting-query-client";

/**
 * A set of typesafe hooks for consuming your API.
 */
export const api = createTRPCReact<AppRouter>();
export { type RouterInputs, type RouterOutputs } from "@stu/api";

const wsClient = createWSClient({
  url: getBaseUrl().replace("http", "ws").replace("3000", "3001"),
});

/**
 * A wrapper for your app that provides the TRPC context.
 * Use only in _app.tsx
 */
export function TRPCProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new PersistingQueryClient(clientRouter));
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
          colorMode: "ansi",
        }),
        wsLink({
          transformer: superjson,
          client: wsClient,
        }),
      ],
    }),
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </api.Provider>
  );
}
