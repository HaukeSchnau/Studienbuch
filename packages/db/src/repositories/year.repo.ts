import { Effect } from "effect";
import type { SchoolId } from "@stu/lib";
import { Database } from "../database";
import { and, eq } from "drizzle-orm";
import * as tables from "../schema";

export class YearRepository extends Effect.Service<YearRepository>()("db/YearRepository", {
  effect: Effect.gen(function* () {
    const getYear = Effect.fn(function* (payload: { school: SchoolId; startYear: number }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.query.Years.findFirst({
          where: and(eq(tables.Years.startYear, payload.startYear), eq(tables.Years.school, payload.school)),
        }),
      );
    });

    const createYear = Effect.fn(function* (payload: {
      name: string;
      startYear: number;
      graduationYear: number;
      school: SchoolId;
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.Years).values({
          name: payload.name,
          startYear: payload.startYear,
          graduationYear: payload.graduationYear,
          school: payload.school,
        }),
      );
    });

    return {
      getYear,
      createYear,
    };
  }),
}) {}
