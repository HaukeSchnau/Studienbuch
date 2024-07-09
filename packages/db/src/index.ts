import { PrismaClient } from "@prisma/client";

import { env } from "../env";

export * from "drizzle-orm/sql";
export { alias } from "drizzle-orm/pg-core";

const globalForPrisma = globalThis as { prisma?: PrismaClient };

/**
 * @deprecated Use `@schnau/db/client` instead
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
