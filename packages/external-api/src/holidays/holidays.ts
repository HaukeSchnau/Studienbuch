import { HolidayWsV1ImplService } from "./generated";

export const getHolidays = async (year: number) =>
  HolidayWsV1ImplService.getHolidaysForStateAndYearUsingGet("NI", year);
