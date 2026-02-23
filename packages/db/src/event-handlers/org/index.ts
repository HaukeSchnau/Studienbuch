import { calendarApplicators } from "./calendar";
import { courseApplicators } from "./courses";
import { schoolApplicators } from "./school";
import { timetableApplicators } from "./timetable";
import type { OrgApplicatorMap } from "./types";

export const orgApplicators: OrgApplicatorMap = {
  ...schoolApplicators,
  ...calendarApplicators,
  ...courseApplicators,
  ...timetableApplicators,
};
