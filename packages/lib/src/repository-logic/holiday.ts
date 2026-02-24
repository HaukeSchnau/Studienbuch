import type { SimpleDate } from "../infrastructure/dates";
import { dateToSimpleDate } from "../infrastructure/dates";

type HolidayDateColumns = {
  start: Date;
  end: Date;
};

export type HolidayWithSimpleDate<THoliday extends HolidayDateColumns> = Omit<THoliday, "start" | "end"> & {
  start: SimpleDate;
  end: SimpleDate;
};

export const toHolidayWithSimpleDate = <THoliday extends HolidayDateColumns>(
  holiday: THoliday,
): HolidayWithSimpleDate<THoliday> => ({
  ...holiday,
  start: dateToSimpleDate(holiday.start),
  end: dateToSimpleDate(holiday.end),
});
