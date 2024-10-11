import fs, { writeFile } from "fs/promises";
import type { ZodType } from "zod";
import { z } from "zod";

import { HolidayDto, HolidayWsV1ImplService } from "./generated";

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
  stateCode: z.nativeEnum(HolidayDto.stateCode),
  year: z.number(),
});

export type Holiday = Required<HolidayDto>;

const parseHolidayResponse = (result: HolidayDto[]) =>
  z.array(holidaySchema).parse(result);

const getHolidaysInternal = async (state: State, year?: number) => {
  if (year) {
    return HolidayWsV1ImplService.getHolidaysForStateAndYearUsingGet(
      state,
      year,
    ).then(parseHolidayResponse);
  }

  return HolidayWsV1ImplService.getHolidaysForStateUsingGet(state).then(
    parseHolidayResponse,
  );
};

export const getHolidays = async (
  state: State,
  year?: number,
): Promise<Holiday[]> => {
  let response: Holiday[];
  const snapshotFile = `/tmp/holidays-${state}-${year}.json`;
  try {
    response = await getHolidaysInternal(state, year);
  } catch {
    const snapshot = await fs.readFile(snapshotFile, "utf-8");
    const json = JSON.parse(snapshot);
    return holidaySchema.array().parse(json);
  }

  await writeFile(snapshotFile, JSON.stringify(response, null, 2));

  return response;
};
