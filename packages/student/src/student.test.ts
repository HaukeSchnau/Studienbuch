import { drizzle } from "drizzle-orm/better-sqlite3";

import { EventApplicator } from ".";
import * as tables from "./schema";

const db = drizzle(":memory:", {
  schema: tables,
});

const applicator = new EventApplicator(db, "123");
