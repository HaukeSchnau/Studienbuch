import type { AppRouter } from "@stu/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import superjson from "superjson";

import { getBaseUrl } from "./base-url";
import { getStorage } from "./storage";

/**
 * A set of typesafe hooks for consuming your API.
 */
export const api = createTRPCReact<AppRouter>();
export type { RouterInputs, RouterOutputs } from "@stu/api";

export const getHeaders = () => {
  const session = getStorage("auth.session");

  return buildHeaders(session?.token);
};

export const getHeadersObject = () => {
  const headsMap = getHeaders();
  return Object.fromEntries(headsMap);
};

const buildHeaders = (sessionToken?: string) => {
  const headers = new Map<string, string>();
  headers.set("x-trpc-source", "expo-react");
  if (sessionToken) headers.set("x-session", sessionToken);

  return headers;
};

/**
 * A wrapper for your app that provides the TRPC context.
 * Use only in _app.tsx
 */
export function TRPCProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: true,
          },
          mutations: {
            onError: (error) => {
              console.error(error);
            },
          },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" || (opts.direction === "down" && opts.result instanceof Error),
          colorMode: "ansi",
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/trpc`,
          transformer: superjson,
          headers: getHeaders(),
        }),
      ],
    }),
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
    </api.Provider>
  );
}
