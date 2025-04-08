import { drizzle } from "drizzle-orm/better-sqlite3";
import { test } from "vitest";

import { EventApplicator } from ".";
import * as tables from "./schema";

const db = drizzle(":memory:", {
  schema: tables,
});

const applicator = new EventApplicator(db, "123");

test("apply event", async () => {
  await applicator.apply({
    type: "org.school.founded",
    data: {
      name: "Test School",
      id: "igs-lil",
      state: "NI",
    },
    id: crypto.randomUUID(),
    timestamp: new Date(),
  });
});
