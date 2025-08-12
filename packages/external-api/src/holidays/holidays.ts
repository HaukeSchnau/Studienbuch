import { parseSimpleDate, type SimpleDate } from "@stu/lib";
import z, { type ZodType } from "zod";
import { HolidaysService, OpenAPI } from "./generated";

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

const holidaySchema: ZodType<Holiday> = z.object({
  name: z.string(),
  start: z.object({
    year: z.number(),
    month: z.number(),
    day: z.number(),
  }),
  end: z.object({
    year: z.number(),
    month: z.number(),
    day: z.number(),
  }),
  state: z.enum(states),
  year: z.number(),
});

export interface Holiday {
  name: string;
  start: SimpleDate;
  end: SimpleDate;
  state: State;
}

// const parseHolidayResponse = (result: HolidayType[]) => z.array(holidaySchema).parse(result);

const getHolidaysInternal = async (state: State, startYear: number) => {
  OpenAPI.BASE = "https://openholidaysapi.org";

  const startDate = `${startYear}-01-01`;
  const endDate = `${startYear + 2}-10-31`; // maximum is 3 years (3 * 365 days). we take a little less than that.

  return HolidaysService.getSchoolHolidays("DE", startDate, endDate, "DE", `DE-${state}`);
};

export const getHolidays = async (state: State, startYear: number): Promise<Holiday[]> => {
  // let response: HolidayResponse[];
  // const snapshotFile = `${env.CACHE_DIR}/holidays-${state}-${startYear}.json`;
  // try {
  //   response = await getHolidaysInternal(state, startYear);
  // } catch (e) {
  //   console.error(e);

  //   try {
  //     response = JSON.parse(await fs.readFile(snapshotFile, "utf-8"));
  //   } catch (e) {
  //     console.error(e);

  //     return [];
  //   }
  // }

  // await mkdir(env.CACHE_DIR, { recursive: true });
  // await writeFile(snapshotFile, JSON.stringify(response, null, 2));

  // return response;

  const response = await getHolidaysInternal(state, startYear);
  return holidaySchema.array().parse(
    response.map((holiday) => {
      const start = parseSimpleDate(holiday.startDate);
      const end = parseSimpleDate(holiday.endDate);
      return {
        name: holiday.name[0]?.text,
        start,
        end,
        state: holiday.subdivisions[0]?.shortName,
        year: start.year,
      };
    }),
  );
};
