import { management } from "./router-legacy/management/router";
import { schools } from "./router-legacy/schools/router";
import { students } from "./router-legacy/students/router";
import { auth } from "./router/auth/router";
import { t } from "./trpc";

export const appRouter = t.router({
  auth,
  management,
  schools,
  students,
});

// export type definition of API
export type AppRouter = typeof appRouter;
