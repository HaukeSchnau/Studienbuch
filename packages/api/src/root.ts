import { auth } from "./router/auth/router";
import { management } from "./router/management/router";
import { schools } from "./router/schools/router";
import { t } from "./trpc";

export const appRouter = t.router({
  auth,
  management,
  schools,
});

// export type definition of API
export type AppRouter = typeof appRouter;
