import type { TRPCLink } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import { useEffect, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { observable } from "@trpc/server/observable";
import { asc, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { parse, stringify } from "superjson";

import type { ClientRouter, LocalQuery } from "./trpc-util";
import { db } from "~/db/client";
import { Mutations } from "~/db/schema";
import { useTrpcClient } from "../api";
import { findLocalProcedure } from "./trpc-util";

export class PersistingQueryClient extends QueryClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(clientRouter: ClientRouter<any>) {
    super({
      defaultOptions: {
        queries: {
          staleTime: 30 * 1000,
          persister: (queryFn, context, query) => {
            const [path, params] = query.queryKey as [
              string[],
              { input: unknown },
            ];
            const localProcedure = findLocalProcedure(clientRouter, [
              ...path,
            ]) as LocalQuery<unknown, unknown> | undefined;

            if (!localProcedure) {
              throw new Error(
                `No local procedure found for query ${path.join(".")}`,
              );
            }

            const promise = queryFn(context);
            if (promise instanceof Promise) {
              void promise.then((data) => {
                this.setQueryData(query.queryKey, data);
                return localProcedure.persist(params.input, data);
                // .catch((e) => console.log(query.queryKey, e));
              });
            }

            if (localProcedure.read) {
              return localProcedure.read(params.input);
            }

            return promise;
          },
        },
      },
    });
  }
}

export function localLink<TRouter extends AnyRouter = AnyRouter>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientRouter: ClientRouter<any>,
): TRPCLink<TRouter> {
  return () => {
    return ({ op, next }) => {
      if (op.type !== "mutation" || op.context.bypassLocal) {
        return next(op);
      }

      const localProcedure = findLocalProcedure(
        clientRouter,
        op.path.split("."),
      );

      if (!localProcedure?.mutate) {
        return next(op);
      }

      return observable((observer) => {
        void (async () => {
          const timestamp = new Date();

          const localPromiseOrResult = localProcedure.mutate(op.input);

          if (localPromiseOrResult instanceof Promise) {
            const res = (await localPromiseOrResult) as unknown;
            observer.next({
              result: {
                data: res,
                type: "data",
              },
            });
          } else {
            observer.next({
              result: {
                data: localPromiseOrResult,
                type: "data",
              },
            });
          }

          await db.insert(Mutations).values({
            timestamp,
            path: op.path,
            input: stringify(op.input),
            status: "PENDING",
          });

          observer.complete();
        })();
      });
    };
  };
}

export const MutationManager = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [initialized, setInitialized] = useState(false);
  const client = useTrpcClient();

  const { data: muts } = useLiveQuery(
    db
      .select()
      .from(Mutations)
      .where(eq(Mutations.status, "PENDING"))
      .orderBy(asc(Mutations.timestamp)),
  );

  useEffect(() => {
    const abortSignal = new AbortController();
    void (async () => {
      for (const mut of muts) {
        if (abortSignal.signal.aborted) {
          return;
        }
        const input = parse(mut.input);
        try {
          await client.mutation(mut.path, input, {
            signal: abortSignal.signal,
            context: {
              bypassLocal: true,
            },
          });

          await db
            .update(Mutations)
            .set({
              status: "PUBLISHED",
            })
            .where(eq(Mutations.timestamp, mut.timestamp));
        } catch (e) {
          console.error("error handling mutation", mut, e);
          await db
            .update(Mutations)
            .set({
              status: "REJECTED",
            })
            .where(eq(Mutations.timestamp, mut.timestamp));
        }
      }
      setInitialized(true);
    })();

    return () => {
      abortSignal.abort();
    };
  }, [muts, client]);

  return initialized ? children : null;
};
