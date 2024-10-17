import { auth } from "./router/auth/router";
import { management } from "./router/management/router";
import { schools } from "./router/schools/router";
import { students } from "./router/students/router";
import { t } from "./trpc";

export const appRouter = t.router({
  auth,
  management,
  schools,
  students,
});

// export type definition of API
export type AppRouter = typeof appRouter;
