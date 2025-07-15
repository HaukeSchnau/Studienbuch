import { Effect } from "effect";
import type { StateCode } from "@stu/lib";
import { Database } from "../database";
import { and, eq } from "drizzle-orm";
import * as tables from "../schema";

export class HolidayRepository extends Effect.Service<HolidayRepository>()("db/HolidayRepository", {
  effect: Effect.gen(function* () {
    const getHoliday = Effect.fn(function* (payload: { name: string; state: StateCode; year: number }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.query.holidays.findFirst({
          where: and(
            eq(tables.holidays.name, payload.name),
            eq(tables.holidays.state, payload.state),
            eq(tables.holidays.year, payload.year),
          ),
        }),
      );
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
      getHoliday,
      createHoliday,
      getAllHolidays,
    };
  }),
}) {}
