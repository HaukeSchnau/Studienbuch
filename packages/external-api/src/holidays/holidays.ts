import { SimpleDate } from "@stu/lib";
import { Effect, Schema } from "effect";
import { ExternalApiError } from "../errors";
import { externalApiHttpConfig } from "../http/config";
import { withExternalApiResilience } from "../http/resilience";
import { type HolidayResponse, HolidaysService, OpenAPI } from "./generated";

const states = [
  "BB",
  "BE",
  "BW",
  "BY",
  "HB",
  "HE",
  "HH",
  "MV",
  "NI",
  "NW",
  "RP",
  "SH",
  "SL",
  "SN",
  "ST",
  "TH",
] as const;

export type State = (typeof states)[number];

const HolidaySchema = Schema.Struct({
  name: Schema.String,
  start: SimpleDate.BasicSimpleDateSchema,
  end: SimpleDate.BasicSimpleDateSchema,
  state: Schema.Literal(...states),
  year: Schema.Int.pipe(Schema.between(1900, 2100)),
});

export interface Holiday {
  name: string;
  start: SimpleDate;
  end: SimpleDate;
  state: State;
}

OpenAPI.BASE = externalApiHttpConfig.holidays.baseUrl;

const getHolidaysInternal = async (state: State, startYear: number) => {
  const startDate = `${startYear}-01-01`;
  const endDate = `${startYear + 2}-10-31`; // maximum is 3 years (3 * 365 days). we take a little less than that to be safe.

  return HolidaysService.getSchoolHolidays("DE", startDate, endDate, "DE", `DE-${state}`);
};

const mapHoliday = Effect.fnUntraced(function* (holiday: HolidayResponse) {
  const start = yield* SimpleDate.decode(holiday.startDate);
  const end = yield* SimpleDate.decode(holiday.endDate);
  return {
    name: holiday.name[0]?.text,
    start,
    end,
    state: holiday.subdivisions[0]?.shortName,
    year: start.year,
  };
});

export const getHolidays = (state: State, startYear: number) =>
  Effect.tryPromise({
    try: () => getHolidaysInternal(state, startYear),
    catch: (error) => new ExternalApiError({ cause: error }),
  }).pipe(
    withExternalApiResilience({
      service: "holidays",
      operation: "schoolHolidays.list",
      policy: externalApiHttpConfig.holidays,
    }),
    Effect.flatMap((holidays) => Effect.all(holidays.map(mapHoliday))),
    Effect.flatMap(Schema.decodeUnknown(HolidaySchema.pipe(Schema.Array))),
  );
