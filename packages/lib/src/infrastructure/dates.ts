import { addMinutes } from "date-fns";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import z from "zod";
import "dayjs/locale/de";

dayjs.locale("de");
dayjs.extend(relativeTime);

export interface SimpleDate {
  year: number;
  month: number;
  day: number;
}

export const simpleDateSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

/**
 * Takes a string in the format YYYY-MM-DD and returns a SimpleDate object
 */
export const parseSimpleDate = (dateStr: string): SimpleDate => {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return { year, month, day };
};

export const formatSimpleDate = (date: SimpleDate): string => {
  return `${date.year}-${date.month.toString().padStart(2, "0")}-${date.day.toString().padStart(2, "0")}`;
};

/**
 * Takes a string in the format HH:MM and returns the number of minutes since midnight
 */
export const parseSimpleTimeOfDay = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  if (hours === undefined || minutes === undefined || Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error(`Invalid time: ${time}`);
  }
  return hours * 60 + minutes;
};

/**
 * Formats a number of minutes to a time string in the format "HH:MM".
 */
export const formatSimpleTimeOfDay = (time: number) => {
  const hours = Math.floor(time / 60);
  const minutes = time % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};
export const simpleDateToDate = (date: SimpleDate): Date => {
  return new Date(date.year, date.month - 1, date.day);
};

export const dateToSimpleDate = (date: Date): SimpleDate => {
  const utcDate = addMinutes(date, -date.getTimezoneOffset());
  return {
    year: utcDate.getFullYear(),
    month: utcDate.getMonth() + 1,
    day: utcDate.getDate(),
  };
};

export const formatDateRelative = (date: Date) => {
  return dayjs(date).fromNow();
};
