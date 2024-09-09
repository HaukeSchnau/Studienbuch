import { auth } from "./router/auth/router";
import { classes } from "./router/classes/router";
import { courses } from "./router/courses/router";
import { management } from "./router/management/router";
import { schools } from "./router/schools/router";
import { semesters } from "./router/semesters/router";
import { substitutions } from "./router/substitutions/router";
import { years } from "./router/years/router";
import { createRouter } from "./trpc";

export const appRouter = createRouter({
  management,
  years,
  classes,
  courses,
  substitutions,
  auth,
  semesters,
  schools,
});

// export type definition of API
export type AppRouter = typeof appRouter;
