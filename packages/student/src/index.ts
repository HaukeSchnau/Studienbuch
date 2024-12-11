import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type { Event, EventApplicatorInterface } from "@stu/lib";

import type * as tables from "./schema";

export class EventApplicator implements EventApplicatorInterface {
  constructor(
    private db: BaseSQLiteDatabase<"sync" | "async", any, typeof tables>,
    private userId: string,
  ) {}

  async verify(event: Event) {
    return true;
  }

  async apply(event: Event) {}
}
