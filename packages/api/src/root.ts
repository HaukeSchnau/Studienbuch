import { auth } from "./router/auth.router";
import { classes } from "./router/classes.router";
import { courses } from "./router/courses.router";
import { license } from "./router/license.router";
import { persons } from "./router/persons.router";
import { schools } from "./router/schools.router";
import { substitutions } from "./router/substitutions.router";
import { users } from "./router/users.router";
import { years } from "./router/years.router";
import { createRouter } from "./trpc";

export const appRouter = createRouter({
  license,
  years,
  classes,
  courses,
  substitutions,
  auth,
  schools,
  users,
  persons,
});

// export type definition of API
export type AppRouter = typeof appRouter;
