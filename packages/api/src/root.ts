import { auth } from "./router/auth.router";
import { classes } from "./router/classes.router";
import { courses } from "./router/courses.router";
import { license } from "./router/license.router";
import { schools } from "./router/schools.router";
import { subscriptions } from "./router/subscriptions.router";
import { substitutions } from "./router/substitutions.router";
import { sync } from "./router/sync.router";
import { users } from "./router/users.router";
import { years } from "./router/years.router";
import { createRouter } from "./trpc";

export const appRouter = createRouter({
  license,
  years,
  classes,
  courses,
  substitutions,
  subscriptions,
  sync,
  auth,
  schools,
  users,
});

// export type definition of API
export type AppRouter = typeof appRouter;
