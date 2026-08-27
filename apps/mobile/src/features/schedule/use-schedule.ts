import { useAtomValue } from "@effect/atom-react";
import { useCallback } from "react";
import { getActiveHoliday as selectActiveHoliday } from "~/compat/mobile-v0";
import { holidaysAtom, visibleTimetableAtom } from "./schedule-atoms";

export function useSchedule() {
  const holidays = useAtomValue(holidaysAtom);
  const timetable = useAtomValue(visibleTimetableAtom);
  const getActiveHoliday = useCallback(
    (date?: Date) => selectActiveHoliday(holidays, date),
    [holidays],
  );

  return { holidays, timetable, getActiveHoliday };
}
