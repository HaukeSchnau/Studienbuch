export const parseTime = (time: string) => {
  if (!time) throw new Error("No time given");

  const split = time.split(":");
  if (!split[0] || !split[1]) throw new Error(`Invalid time given: ${time}`);
  const hours = parseInt(split[0]);
  const minutes = parseInt(split[1]);

  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  )
    throw new Error(`Invalid time given: ${time}`);

  return hours * 60 + minutes;
};

const normalTimes = [
  8 * 60,
  9 * 60 + 45,
  11 * 60 + 30,
  13 * 60 + 50,
  15 * 60 + 15,
];

export const isNormalTime = (time: number) => normalTimes.includes(time);
