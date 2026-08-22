import { useAtomValue } from "@effect/atom-react";
import { useCallback } from "react";
import { getActiveHoliday } from "~/compat/mobile-v0";
import { holidaysAtom, visibleTimetableAtom } from "./schedule-atoms";

export function useSchedule() {
  const holidays = useAtomValue(holidaysAtom);
  const timetable = useAtomValue(visibleTimetableAtom);
  const findActiveHoliday = useCallback(
    (date?: Date) => getActiveHoliday(holidays, date),
    [holidays],
  );

  return { holidays, timetable, getActiveHoliday: findActiveHoliday };
}
