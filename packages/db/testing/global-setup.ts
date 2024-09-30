import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createClient } from "./client";
import { insertFixtures } from "./insert-fixtures";

export default async function setup({ provide }) {
  const container = await new PostgreSqlContainer()
    .withTmpFs({
      "/var/lib/postgresql/data": "rw",
    })
    .start();

  const { db, client } = await createClient(container.getConnectionUri());
  await migrate(db, {
    migrationsFolder: "./packages/db/drizzle",
  });

  await insertFixtures(db);
  await client.end();

  provide("database", {
    host: container.getHost(),
    port: container.getPort(),
    username: container.getUsername(),
    password: container.getPassword(),
    database: container.getDatabase(),
  });

  return () => container.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    database: {
      host: string;
      port: number;
      username: string;
      password: string;
      database: string;
    };
  }
}
