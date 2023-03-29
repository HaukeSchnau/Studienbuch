import { generateOpenApiDocument } from "trpc-openapi";

import { classesRouter } from "./router/classesRouter";
import { coursesRouter } from "./router/coursesRouter";
import { licenseRouter } from "./router/licenseRouter";
import { yearsRouter } from "./router/yearsRouter";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  license: licenseRouter,
  years: yearsRouter,
  classes: classesRouter,
  courses: coursesRouter,
});

export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: "ClassCompanion API",
  version: "1.0.0",
  baseUrl:
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://classcompanion.haukeschnau.de",
});

// export type definition of API
export type AppRouter = typeof appRouter;
