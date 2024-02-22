import { fetch } from "cross-fetch";
import dayjs from "dayjs";
import { z } from "zod";

const dateRegex = /[0-9]{4}-[0-9]{2}-[0-9]{2}/;
const jsonDate = z
  .string()
  .regex(dateRegex)
  .transform((str) => dayjs(str));
const holidaySchema = z.array(
  z.object({
    start: jsonDate,
    end: jsonDate,
  }),
);

export const isHolidayToday = async () => {
  const today = dayjs();
  const currentYear = today.year();

  const holidays = await fetch(
    `https://ferien-api.de/api/v1/holidays/NI/${currentYear}`,
  )
    .then((res) => res.json())
    .then((res) => holidaySchema.parse(res));

  for (const holiday of holidays) {
    if (today.isAfter(holiday.start) && today.isBefore(holiday.end)) {
      return true;
    }
  }

  return false;
};
