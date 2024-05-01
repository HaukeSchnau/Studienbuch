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

export const getHolidays = async (state: State, year?: number) => {
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
