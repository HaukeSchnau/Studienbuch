import { createContext, useContext, useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { eq } from "drizzle-orm";
import superjson from "superjson";

import type { AppRouter } from "@stu/api";
import type { Event } from "@stu/lib";
import { Result } from "@stu/lib";
import * as tables from "@stu/student/schema";

import { db } from "~/db/client";
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
  const session = getStorage("auth.session");

  return buildHeaders(session?.token);
};

export const buildHeaders = (sessionToken?: string) => {
  const headers = new Map<string, string>();
  headers.set("x-trpc-source", "expo-react");
  if (sessionToken) headers.set("x-session", sessionToken);

  return headers;
};

export const publishEvent = async (
  event: Omit<Event, "errors">,
): Promise<
  Result<
    undefined,
    "CONFLICT" | "NETWORK_NOT_REACHABLE" | "INVALID_RESPONSE" | Response
  >
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
      await db
        .update(tables.events)
        .set({
          publishStatus: "success",
        })
        .where(eq(tables.events.id, event.id));

      return Result.err("CONFLICT" as const);
    }

    if (response.status !== 200) {
      // await db
      //   .update(tables.events)
      //   .set({
      //     isFailed: true,
      //     isPublished: true,
      //   })
      //   .where(eq(tables.events.id, event.id));
      return Result.err(response);
    }

    const rtext = await response.text();
    console.log(rtext);

    await db
      .update(tables.events)
      .set({
        publishStatus: "success",
      })
      .where(eq(tables.events.id, event.id));

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
    <trpcClientContext.Provider value={trpcClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {props.children}
        </QueryClientProvider>
      </api.Provider>
    </trpcClientContext.Provider>
  );
}
