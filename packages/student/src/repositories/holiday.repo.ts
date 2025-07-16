import type { StateCode } from "@stu/lib";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class HolidayRepository extends Effect.Service<HolidayRepository>()("student/HolidayRepository", {
  effect: Effect.gen(function* () {
    const doesHolidayExist = Effect.fn(function* (payload: {
      name: string;
      start: Date;
      end: Date;
      state: StateCode;
      year: number;
    }) {
      const { execute } = yield* Database;
      const holiday = yield* execute((db) =>
        db.query.holidays.findFirst({
          where: eq(tables.holidays.name, payload.name),
        }),
      );
      return holiday !== undefined;
    });

    const createHoliday = Effect.fn(function* (payload: {
      name: string;
      start: Date;
      end: Date;
      state: StateCode;
      year: number;
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.holidays).values({
          name: payload.name,
          start: payload.start,
          end: payload.end,
          state: payload.state,
          year: payload.year,
        }),
      );
    });

    const getAllHolidays = Effect.fn(function* () {
      const { execute } = yield* Database;
      return yield* execute((db) => db.query.holidays.findMany());
    });

    return {
      doesHolidayExist,
      createHoliday,
      getAllHolidays,
    };
  }),
}) {}
