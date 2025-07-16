import type { SchoolId } from "@stu/lib";
import { Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class SemesterRepository extends Effect.Service<SemesterRepository>()("db/SemesterRepository", {
  effect: Effect.gen(function* () {
    const createSemesters = Effect.fn(function* (
      payload: { name: string; start: Date; end: Date; type: "WINTER" | "SUMMER"; year: number; school: SchoolId }[],
    ) {
      const { execute } = yield* Database;
      yield* execute((db) => db.insert(tables.semesters).values(payload));
    });
    return { createSemesters };
  }),
}) {}
