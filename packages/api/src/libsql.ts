import { createClient } from "@libsql/client";

import { env } from "../env";

export const createNamespaceClient = (namespace: string) =>
  createClient({
    url: env.LIBSQL_URL,
    fetch: (input: string | URL | globalThis.Request, init?: RequestInit) =>
      fetch(input, {
        ...init,
        headers: {
          ...init?.headers,
          "x-namespace-bin": Buffer.from(namespace)
            .toString("base64")
            .replace(/=/g, ""), // remove padding
        },
      }),
  });

const SHARED_SCHEMA_NAMESPACE = "schema";

export const createSchemaClient = () =>
  createNamespaceClient(SHARED_SCHEMA_NAMESPACE);

export const createSharedSchema = async () => {
  await fetch(
    `${env.LIBSQL_ADMIN_URL}/v1/namespaces/${SHARED_SCHEMA_NAMESPACE}/create`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${env.LIBSQL_ADMIN_AUTH_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ shared_schema: true }),
    },
  );
};

export const createNamespace = async (namespace: string) => {
  await fetch(`${env.LIBSQL_ADMIN_URL}/v1/namespaces/${namespace}/create`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${env.LIBSQL_ADMIN_AUTH_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ shared_schema_name: SHARED_SCHEMA_NAMESPACE }),
  });
};
