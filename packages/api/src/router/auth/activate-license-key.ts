import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import { Result } from "@stu/lib";
import { createSession } from "@stu/lib-server";

import { publicProcedure } from "../../procedures";
import { ingest } from "../events/ingest";

const activate = async (license: {
  activatedBy: string | null;
  key: string;
}) => {
  if (license.activatedBy) {
    return license.activatedBy;
  }

  const userId = crypto.randomUUID();

  const res = await ingest(
    "auth.licenseActivated",
    {
      data: {
        licenseKey: license.key,
        userId,
      },
      id: crypto.randomUUID(),
      timestamp: new Date(),
    },
    userId,
  );

  if (Result.isErr(res)) {
    console.error(res);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: res.error,
    });
  }

  return userId;
};

export const activateLicenseKey = publicProcedure
  .input(
    z.object({
      licenseKey: z.string(),
    }),
  )
  .mutation(async ({ input: { licenseKey } }) => {
    const license = await db.query.LicenseKeys.findFirst({
      where: eq(tables.LicenseKeys.key, licenseKey),
    });

    if (!license) {
      return {
        error: {
          field: "licenseKey" as const,
          message: "Ungültiger Lizenzschlüssel",
        },
      };
    }

    const userId = await activate(license);

    const [session] = await db
      .insert(tables.Sessions)
      .values(createSession({ id: userId }))
      .returning();

    if (!session) {
      console.error("Failed to create session.");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return {
      session: {
        userId: session.user,
        token: session.token,
        expires: session.expires,
      },
    };
  });
