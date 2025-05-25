import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type * as tables from "../schema";

export type DB = BaseSQLiteDatabase<"sync" | "async", any, typeof tables>;
interface User {
  isOfAge: boolean;
}

export interface Extra {
  db: DB;
  user: User;
}
