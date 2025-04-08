import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type * as tables from "../schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DB = BaseSQLiteDatabase<"sync" | "async", any, typeof tables>;
interface User {
  isOfAge: boolean;
}

export interface Extra {
  db: DB;
  user: User;
}
