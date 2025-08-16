import dayjs from "dayjs";

import "dayjs/locale/de";

import relativeTime from "dayjs/plugin/relativeTime";

dayjs.locale("de");
dayjs.extend(relativeTime);

/**
 * Parses a time string in the format "HH:MM" to a number of minutes.
 */
export const parseTime = (time: string) => {
  if (!time) throw new Error("No time given");

  const split = time.split(":");
  if (!split[0] || !split[1]) throw new Error(`Invalid time given: ${time}`);
  const hours = Number.parseInt(split[0], 10);
  const minutes = Number.parseInt(split[1], 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59)
    throw new Error(`Invalid time given: ${time}`);

  return hours * 60 + minutes;
};

export const normalTimes = [8 * 60, 9 * 60 + 45, 11 * 60 + 30, 13 * 60 + 50, 15 * 60 + 15];

/**
 * Checks if a time is a normal time. Normal times are 8:00, 9:45, 11:30, 13:50 and 15:15.
 */
export const isNormalTime = (time: number) => normalTimes.includes(time);

/**
 * Formats a number of minutes to a time string in the format "HH:MM".
 */
export const formatTime = (time: number) => {
  const hours = Math.floor(time / 60);
  const minutes = time % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

export const formatDateRelative = (date: Date) => {
  return dayjs(date).fromNow();
};
