import { writeFile } from "fs/promises";
import p from "path";
import { fileURLToPath } from "url";
import type { ZodType } from "zod";
import { z } from "zod";

import { HolidayDto, HolidayWsV1ImplService } from "./generated";
import snapshotData from "./holidays.snapshot.json";

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

const holidaySchema: ZodType<Required<HolidayDto>> = z.object({
  end: z.string(),
  name: z.string(),
  slug: z.string(),
  start: z.string(),
  stateCode: z.nativeEnum(HolidayDto.stateCode),
  year: z.number(),
});
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

export const getHolidays = async (state: State, year?: number) => {
  let response: Awaited<ReturnType<typeof getHolidaysInternal>>;
  try {
    response = await getHolidaysInternal(state, year);
  } catch {
    return snapshotData;
  }

  await writeFile(
    p.resolve(
      p.dirname(fileURLToPath(import.meta.url)),
      "holidays.snapshot.json",
    ),
    JSON.stringify(response, null, 2),
  );

  return response;
};
