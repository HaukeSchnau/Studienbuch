import { generateOpenApiDocument } from "trpc-openapi";

import { licenseRouter } from "./router/licenseRouter";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  license: licenseRouter,
});

export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: "ClassCompanion API",
  version: "1.0.0",
  baseUrl: "http://localhost:3000/api",
});

// export type definition of API
export type AppRouter = typeof appRouter;
