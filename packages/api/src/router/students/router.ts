import type { TRPCRouterRecord } from "@trpc/server";

import { absences } from "./absences/router";
import { courses } from "./courses/router";
import { grades } from "./grades/router";
import { semesters } from "./semesters/router";
import { tasks } from "./tasks/router";
import { timetable } from "./timetable/router";
import { years } from "./years/router";

export const students = {
  absences,
  courses,
  grades,
  semesters,
  tasks,
  timetable,
  years,
} satisfies TRPCRouterRecord;
