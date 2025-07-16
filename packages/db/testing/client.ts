import * as schema from "@stu/db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

export type Client = NodePgDatabase<typeof schema>;

export const createClient = async (config: string | pg.ClientConfig) => {
  const client = new pg.Client(config);
  await client.connect();

  const db = drizzle(client, {
    schema,
  });

  return { client, db };
};
