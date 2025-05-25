import crypto from "crypto";
import pg from "pg";
import { beforeAll, inject, vi } from "vitest";

import * as exports from "@stu/db/client";

import { createClient } from "./client";

beforeAll(async ({ id }) => {
  const database = inject("database");

  const client = new pg.Client({
    host: database.host,
    port: database.port,
    user: database.username,
    password: database.password,
  });

  const idHash = crypto.createHash("md5").update(id).digest("hex");
  const testDbName = `test_${idHash}`;

  await client.connect();
  await client.query(
    `CREATE DATABASE ${testDbName} WITH TEMPLATE ${database.database};`,
  );

  const { db } = await createClient({
    host: database.host,
    port: database.port,
    user: database.username,
    password: database.password,
    database: testDbName,
  });

  vi.mock(import("@stu/db/client"), () => ({ db: null! }));
  vi.spyOn(exports, "db", "get").mockReturnValue(db);
});
