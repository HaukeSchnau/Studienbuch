import { auth } from "./router/auth/router";
import { classes } from "./router/classes/router";
import { courses } from "./router/courses/router";
import { management } from "./router/management/router";
import { schools } from "./router/schools/router";
import { semesters } from "./router/semesters/router";
import { substitutions } from "./router/substitutions/router";
import { timetable } from "./router/timetable/router";
import { years } from "./router/years/router";
import { t } from "./trpc";

export const appRouter = t.router({
  auth,
  classes,
  courses,
  management,
  schools,
  semesters,
  substitutions,
  timetable,
  years,
});

// export type definition of API
export type AppRouter = typeof appRouter;
