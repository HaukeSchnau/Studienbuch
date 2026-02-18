import pg from "pg";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";

const database = inject("database");
process.env.MANAGEMENT_DATABASE_URL = database.connectionUri;

let adminClient: pg.Client | undefined;

beforeAll(async () => {
  adminClient = new pg.Client(database.connectionUri);
  await adminClient.connect();
});

beforeEach(async () => {
  if (!adminClient) {
    throw new Error("Test database client is not initialized");
  }

  const rows = await adminClient.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );

  if (rows.rows.length === 0) {
    return;
  }

  const tableList = rows.rows.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
  await adminClient.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
});

afterAll(async () => {
  if (adminClient) {
    await adminClient.end();
  }
});
