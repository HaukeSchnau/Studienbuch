import type { SchoolId } from "@stu/lib";
import { sql } from "drizzle-orm";
import { Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class SemesterRepository extends Effect.Service<SemesterRepository>()("db/SemesterRepository", {
  effect: Effect.gen(function* () {
    const createSemesters = Effect.fn(function* (
      payload: { name: string; start: Date; end: Date; type: "WINTER" | "SUMMER"; year: number; school: SchoolId }[],
    ) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db
          .insert(tables.Semesters)
          .values(payload)
          .onConflictDoUpdate({
            target: [tables.Semesters.school, tables.Semesters.type, tables.Semesters.year],
            set: {
              name: sql`excluded.name`,
              start: sql`excluded.start`,
              end: sql`excluded.end`,
              type: sql`excluded.type`,
              year: sql`excluded.year`,
              school: sql`excluded.school`,
            },
          }),
      );
    });
    return { createSemesters };
  }),
}) {}
