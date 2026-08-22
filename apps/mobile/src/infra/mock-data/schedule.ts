import type { Holiday, TimetableEntry } from "~/compat/mobile-v0";
import { makeMockWeekDate } from "./clock";

export const timetableSeed: TimetableEntry[] = [
  { id: "tt1", courseId: "ma-1", start: makeMockWeekDate(0, 8, 0), duration: 80 },
  { id: "tt2", courseId: "de-1", start: makeMockWeekDate(0, 9, 45), duration: 80 },
  { id: "tt3", courseId: "en-1", start: makeMockWeekDate(1, 8, 0), duration: 80 },
  { id: "tt4", courseId: "ph-1", start: makeMockWeekDate(2, 11, 30), duration: 80 },
  { id: "tt5", courseId: "ge-1", start: makeMockWeekDate(3, 12, 50), duration: 80 },
  { id: "tt6", courseId: "sp-1", start: makeMockWeekDate(4, 13, 50), duration: 80 },
];

export const holidaysSeed: Holiday[] = [
  {
    id: "h-summer-2026",
    name: "Sommerferien",
    start: new Date("2026-07-16T00:00:00"),
    end: new Date("2026-08-26T23:59:59"),
  },
  {
    id: "h-fall-2026",
    name: "Herbstferien",
    start: new Date("2026-10-12T00:00:00"),
    end: new Date("2026-10-24T23:59:59"),
  },
  {
    id: "h-christmas-2026",
    name: "Weihnachtsferien",
    start: new Date("2026-12-23T00:00:00"),
    end: new Date("2027-01-06T23:59:59"),
  },
];
