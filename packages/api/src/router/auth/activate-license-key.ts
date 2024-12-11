import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { db, eq, tables } from "../../postgres";
import { publicProcedure } from "../../procedures";

export const activateLicenseKey = publicProcedure
  .input(
    z.object({
      licenseKey: z.string(),
      name: z.string().min(2),
    }),
  )
  .mutation(async ({ input }) => {
    const licenseKey = await db.query.licenseKeys.findFirst({
      where: eq(tables.licenseKeys.key, input.licenseKey),
    });
    if (!licenseKey) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "License key not found",
      });
    }
    // if (licenseKey.isSuperKey) {
    //   return;
    // }
    // if (licenseKey.expiresAt && licenseKey.expiresAt < new Date()) {
    //   throw new TRPCError({
    //     code: "BAD_REQUEST",
    //     message: "License key expired",
    //   });
    // }
    if (licenseKey.activatedBy) {
      return;
    }

    const [user] = await db
      .insert(tables.users)
      .values({
        type: "student",
      })
      .returning();
    if (!user) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create user",
      });
    }
    await db
      .update(tables.licenseKeys)
      .set({
        activatedAt: new Date(),
        activatedBy: user.id,
      })
      .where(eq(tables.licenseKeys.key, licenseKey.key));
  });
