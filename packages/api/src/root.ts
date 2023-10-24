import { generateOpenApiDocument } from "trpc-openapi";

import { classesRouter } from "./router/classesRouter";
import { coursesRouter } from "./router/coursesRouter";
import { sync } from "./router/syncRouter";
import { licenseRouter } from "./router/licenseRouter";
import { subscriptionsRouter } from "./router/subscriptionsRouter";
import { substitutionsRouter } from "./router/substitutionsRouter";
import { yearsRouter } from "./router/yearsRouter";
import { authRouter } from "./features/auth/auth.router";
import { createRouter } from "./trpc";

export const appRouter = createRouter({
  license: licenseRouter,
  years: yearsRouter,
  classes: classesRouter,
  courses: coursesRouter,
  substitutions: substitutionsRouter,
  subscriptions: subscriptionsRouter,
  sync,
  auth: authRouter
});

export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: "ClassMate API",
  version: "1.0.0",
  baseUrl:
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000/api"
      : "https://classmate.haukeschnau.de/api",
});

// export type definition of API
export type AppRouter = typeof appRouter;
