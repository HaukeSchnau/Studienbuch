import fs, { writeFile, mkdir } from "node:fs/promises";
import type { ZodType } from "zod";
import { z } from "zod";
import { env } from "../../env";
import type { HolidayDto } from "./generated";
import { HolidayWsV1ImplService } from "./generated";

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
export const stateSchema = z.enum(states);

const holidaySchema: ZodType<Holiday> = z.object({
  end: z.string(),
  name: z.string(),
  slug: z.string(),
  start: z.string(),
  stateCode: z.enum(states),
  year: z.number(),
});

export interface Holiday {
  end: string;
  name: string;
  slug: string;
  start: string;
  stateCode: State;
  year: number;
}

const parseHolidayResponse = (result: HolidayDto[]) => z.array(holidaySchema).parse(result);

const getHolidaysInternal = async (state: State, year?: number) => {
  if (year) {
    return HolidayWsV1ImplService.getHolidaysForStateAndYearUsingGet(state, year).then(parseHolidayResponse);
  }

  return HolidayWsV1ImplService.getHolidaysForStateUsingGet(state).then(parseHolidayResponse);
};

export const getHolidays = async (state: State, year?: number): Promise<Holiday[]> => {
  let response: Holiday[];
  const snapshotFile = `${env.CACHE_DIR}/holidays-${state}-${year}.json`;
  try {
    response = await getHolidaysInternal(state, year);
  } catch (e) {
    console.error(e);

    try {
      const snapshot = await fs.readFile(snapshotFile, "utf-8");
      response = holidaySchema.array().parse(JSON.parse(snapshot));
    } catch (e) {
      console.error(e);

      return [];
    }
  }

  await mkdir(env.CACHE_DIR, { recursive: true });
  await writeFile(snapshotFile, JSON.stringify(response, null, 2));

  return response;
};
