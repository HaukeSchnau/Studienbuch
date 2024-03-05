import { createHash } from "crypto";
import type { DocumentNode } from "graphql/language/ast";
import { LinearGraphQLClient, LinearSdk, parseLinearError } from "@linear/sdk";

import { cacheResponse, getCachedResponse } from "@schnau/db";

import { env } from "../../env";

class CachingLinearClient extends LinearSdk {
  public client: LinearGraphQLClient;

  constructor() {
    const graphQLClient = new LinearGraphQLClient(
      "https://api.linear.app/graphql",
      {
        headers: {
          Authorization: env.LINEAR_API_KEY,
        },
      },
    );

    super(
      async <Data, Variables extends Record<string, unknown>>(
        doc: DocumentNode,
        vars?: Variables,
      ) => {
        const docHash = createHash("sha256").update(JSON.stringify(doc));
        if (vars) {
          docHash.update(JSON.stringify(vars));
        }
        const cacheKey = `linear:${docHash.digest("hex")}`;

        const cached = await getCachedResponse(cacheKey);
        if (cached) {
          return cached as Data;
        }

        /** Call the LinearGraphQLClient */
        const data = await this.client
          .request<Data, Variables>(doc, vars)
          .catch((error) => {
            /** Catch and wrap errors from the LinearGraphQLClient */
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            throw parseLinearError(error);
          });

        await cacheResponse(cacheKey, data, 60 * 15);

        return data;
      },
    );

    this.client = graphQLClient;
  }
}

const linearClient = new CachingLinearClient();

export const getLinearClient = () => {
  return linearClient;
};
