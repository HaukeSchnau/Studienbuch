import { dateToSimpleDate, HolidayRepository, type StateCode, simpleDateToDate } from "@stu/lib";
import { and, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

const toUtc = (date: Date) => {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
};

export const HolidayRepositoryLive = Layer.effect(
  HolidayRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    const getHoliday = Effect.fn(function* (payload: { name: string; state: StateCode; year: number }) {
      const { execute } = yield* databaseContext;
      const holiday = yield* execute((db) =>
        db.query.holidays.findFirst({
          where: and(
            eq(tables.holidays.name, payload.name),
            eq(tables.holidays.state, payload.state),
            eq(tables.holidays.year, payload.year),
          ),
        }),
      );
      return (
        holiday && {
          ...holiday,
          start: dateToSimpleDate(holiday.start),
          end: dateToSimpleDate(holiday.end),
        }
      );
    });

    return {
      getHoliday,

      doesHolidayExist: Effect.fn(function* (payload) {
        const holiday = yield* getHoliday(payload);
        return holiday !== undefined;
      }),

      createHoliday: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db.insert(tables.holidays).values({
            name: payload.name,
            start: toUtc(simpleDateToDate(payload.start)),
            end: toUtc(simpleDateToDate(payload.end)),
            state: payload.state,
            year: payload.year,
          }),
        );
      }),

      getAllHolidays: Effect.fn(function* () {
        const { execute } = yield* databaseContext;
        return yield* execute((db) => db.query.holidays.findMany()).pipe(
          Effect.map((holidays) =>
            holidays.map((holiday) => ({
              ...holiday,
              start: dateToSimpleDate(holiday.start),
              end: dateToSimpleDate(holiday.end),
            })),
          ),
        );
      }),
    };
  }),
);
