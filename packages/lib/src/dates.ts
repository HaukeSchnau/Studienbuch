export interface SimpleDate {
  year: number;
  month: number;
  day: number;
}

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
  if (
    hours === undefined ||
    minutes === undefined ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    throw new Error(`Invalid time: ${time}`);
  }
  return hours * 60 + minutes;
};
