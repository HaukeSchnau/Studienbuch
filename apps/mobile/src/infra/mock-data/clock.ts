import { addDays, set } from "date-fns";

export const mockNow = new Date();

const mockWeekStart = addDays(mockNow, -((mockNow.getDay() + 6) % 7));

export const makeMockWeekDate = (dayOffset: number, hours: number, minutes = 0) =>
  set(addDays(mockWeekStart, dayOffset), { hours, minutes, seconds: 0, milliseconds: 0 });
