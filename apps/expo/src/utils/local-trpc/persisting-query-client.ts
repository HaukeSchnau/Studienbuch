import { QueryClient } from "@tanstack/react-query";

import type { ClientRouter } from "./trpc-util";
import { findLocalProcedure } from "./trpc-util";

export class PersistingQueryClient extends QueryClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(clientRouter: ClientRouter<any>) {
    super({
      defaultOptions: {
        queries: {
          persister: (queryFn, context, query) => {
            const [path, params] = query.queryKey as [
              string[],
              { input: unknown },
            ];
            const localProcedure = findLocalProcedure(clientRouter, [...path]);

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
