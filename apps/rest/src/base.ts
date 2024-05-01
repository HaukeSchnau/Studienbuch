import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { trimTrailingSlash } from "hono/trailing-slash";

export const createBase = (basePath: string) => {
  const app = new OpenAPIHono().basePath(basePath);

  app.use(trimTrailingSlash());
  app.use(prettyJSON());
  app.use(logger());

  app.doc("/openapi", {
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "My API",
    },
    servers: [
      {
        description: "Production server",
        url: "https://api.studienbuch.app",
      },
      {
        description: "Development server",
        url: "http://localhost:3000",
      },
    ],
  });

  app.get(
    "/reference",
    apiReference({
      theme: "purple",
      spec: {
        url: "/openapi",
      },
    }),
  );

  return app;
};
