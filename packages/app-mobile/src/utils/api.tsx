import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import superjson from "superjson";

import type { AppRouter } from "@stu/api";
import type { Event } from "@stu/lib";
import { Result } from "@stu/lib";

import { getBaseUrl } from "./base-url";
import { getStorage } from "./storage";

/**
 * A set of typesafe hooks for consuming your API.
 */
export const api = createTRPCReact<AppRouter>();
export type { RouterInputs, RouterOutputs } from "@stu/api";

const getHeaders = () => {
  const session = getStorage("auth.session");

  return buildHeaders(session?.token);
};

export const buildHeaders = (sessionToken?: string) => {
  const headers = new Map<string, string>();
  headers.set("x-trpc-source", "expo-react");
  if (sessionToken) headers.set("x-session", sessionToken);

  return headers;
};

/**
 * Publish an event to the server.
 * @param event - The event to publish. It must already be persisted in the local database.
 * @returns A result indicating success or failure.
 */
export const publishEvent = async (
  event: Omit<Event, "errors">,
): Promise<
  Result<undefined, "NETWORK_NOT_REACHABLE" | "INVALID_RESPONSE" | Response>
> => {
  console.log("publishing event");
  const headers = getHeaders();
  headers.set("Content-Type", "application/json");

  try {
    const response = await fetch(`${getBaseUrl()}/events`, {
      method: "POST",
      body: superjson.stringify(event),
      headers: Object.fromEntries(headers),
    });
    if (response.status === 409) {
      return Result.ok(undefined);
    }

    if (response.status !== 200) {
      return Result.err(response);
    }

    const rtext = await response.text();
    console.log(rtext);

    return Result.ok(undefined);
  } catch (e) {
    if (e instanceof TypeError) {
      console.warn(e);
      return Result.err("NETWORK_NOT_REACHABLE" as const);
    }

    throw e;
  }
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
        },
      }),
  );
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
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </api.Provider>
  );
}
