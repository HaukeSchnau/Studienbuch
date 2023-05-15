import { generateOpenApiDocument } from "trpc-openapi";

import { classesRouter } from "./router/classesRouter";
import { coursesRouter } from "./router/coursesRouter";
import { licenseRouter } from "./router/licenseRouter";
import { substitutionsRouter } from "./router/substitutionsRouter";
import { yearsRouter } from "./router/yearsRouter";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  license: licenseRouter,
  years: yearsRouter,
  classes: classesRouter,
  courses: coursesRouter,
  substitutions: substitutionsRouter,
});

export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: "ClassCompanion API",
  version: "1.0.0",
  baseUrl:
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000/api"
      : "https://classcompanion.haukeschnau.de/api",
});

// export type definition of API
export type AppRouter = typeof appRouter;
