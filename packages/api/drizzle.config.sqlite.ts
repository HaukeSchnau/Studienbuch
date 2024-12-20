import type { Config } from "drizzle-kit";

import { createSchemaClient, createSharedSchema } from "./src/libsql";

createSharedSchema()
  .then(() => console.log("Schema created"))
  .catch(console.error);

export default {
  schema: "../student/src/schema/index.ts",
  dialect: "turso",
  dbCredentials: {
    url: "unused",
    // @ts-expect-error: added functionality via patch
    client: createSchemaClient(),
  },
  verbose: true,
} satisfies Config;
