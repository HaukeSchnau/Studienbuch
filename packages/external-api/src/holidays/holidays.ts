import { z } from "zod";

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

export const getHolidays = async (state: State, year?: number) => {
  if (year) {
    return HolidayWsV1ImplService.getHolidaysForStateAndYearUsingGet(
      state,
      year,
    );
  }

  return HolidayWsV1ImplService.getHolidaysForStateUsingGet(state);
};
