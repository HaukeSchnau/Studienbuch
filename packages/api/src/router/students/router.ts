import type { TRPCRouterRecord } from "@trpc/server";

import { absences } from "./absences/router";
import { grades } from "./grades/router";
import { tasks } from "./tasks/router";
import { timetable } from "./timetable/router";

export const students = {
  absences,
  grades,
  tasks,
  timetable,
} satisfies TRPCRouterRecord;
