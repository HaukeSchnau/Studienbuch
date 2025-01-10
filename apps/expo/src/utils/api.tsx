import { createContext, useContext, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@stu/api";
import type { Event } from "@stu/lib";

import { getBaseUrl } from "./base-url";
import { getStorage } from "./storage";

/**
 * A set of typesafe hooks for consuming your API.
 */
export const api = createTRPCReact<AppRouter>();
export { type RouterInputs, type RouterOutputs } from "@stu/api";

// Not sure why we can't use the client from useUtils directly
const trpcClientContext = createContext<ReturnType<typeof api.createClient>>(
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  null!,
);

export const useTrpcClient = () => {
  return useContext(trpcClientContext);
};

const getHeaders = () => {
  const headers = new Map<string, string>();
  headers.set("x-trpc-source", "expo-react");
  const session = getStorage("auth.session");
  if (session?.token) headers.set("x-session", session.token);

  return headers;
};

export const publishEvent = (event: Omit<Event, "errors">) => {
  const headers = getHeaders();
  headers.set("Content-Type", "application/json");

  return fetch(`${getBaseUrl()}/events`, {
    method: "POST",
    body: superjson.stringify(event),
    headers: Object.fromEntries(headers),
  });
};

/**
 * A wrapper for your app that provides the TRPC context.
 * Use only in _app.tsx
 */
export function TRPCProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
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
    <trpcClientContext.Provider value={trpcClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {props.children}
        </QueryClientProvider>
      </api.Provider>
    </trpcClientContext.Provider>
  );
}
