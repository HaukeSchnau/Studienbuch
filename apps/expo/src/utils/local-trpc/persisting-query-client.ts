import type { TRPCLink } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import { QueryClient } from "@tanstack/react-query";
import { observable } from "@trpc/server/observable";
import { eq } from "drizzle-orm";

import type { ClientRouter, LocalQuery } from "./trpc-util";
import { db } from "~/db/client";
import { Mutations } from "~/db/schema";
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

            const promise = queryFn(context);
            if (promise instanceof Promise) {
              void promise.then((data) => {
                this.setQueryData(query.queryKey, data);
                return localProcedure?.persist(params.input, data);
              });
            }

            if (localProcedure) {
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
      if (op.type !== "mutation") {
        return next(op);
      }

      return observable((observer) => {
        const localProcedure = findLocalProcedure(
          clientRouter,
          op.path.split("."),
        );

        if (localProcedure?.mutate) {
          void (async () => {
            const handleLocalResponse = (output: unknown) => {
              observer.next({
                result: {
                  data: output,
                  type: "data",
                },
              });
              observer.complete();
              next(op).subscribe({
                next: (value) => {
                  console.log("result", value, op);
                  db.update(Mutations)
                    .set({
                      status: "PUBLISHED",
                    })
                    .where(eq(Mutations.timestamp, timestamp));
                },
                error: (err) => {
                  console.error("err", err, op);
                  db.update(Mutations)
                    .set({
                      status: "REJECTED",
                    })
                    .where(eq(Mutations.timestamp, timestamp));
                },
                complete: () => {
                  console.log("complete", op);
                },
              });
            };

            const timestamp = new Date();
            await db.insert(Mutations).values({
              timestamp,
              path: op.path,
              input: op.input,
              status: "PENDING",
            });

            const localPromiseOrResult = localProcedure.mutate(op.input);

            if (localPromiseOrResult instanceof Promise) {
              void localPromiseOrResult.then(handleLocalResponse);
            } else {
              handleLocalResponse(localPromiseOrResult);
            }
          })();

          return;
        }

        return next(op).subscribe(observer);
      });
    };
  };
}
