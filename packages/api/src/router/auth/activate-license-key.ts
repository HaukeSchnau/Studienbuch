import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { LicenseKeys, Persons, Users } from "@stu/db/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "../../procedures";

export const activateLicenseKey = publicProcedure
    .input(
      z.object({
        licenseKey: z.string(),
        name: z.string().min(2),
      }),
    )
    .mutation(async ({ input }) => {
      const licenseKey = await db.query.LicenseKeys.findFirst({
        where: eq(LicenseKeys.key, input.licenseKey),
      });
      if (!licenseKey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "License key not found",
        });
      }
      if (licenseKey.isSuperKey) {
        return;
      }
      // if (licenseKey.expiresAt && licenseKey.expiresAt < new Date()) {
      //   throw new TRPCError({
      //     code: "BAD_REQUEST",
      //     message: "License key expired",
      //   });
      // }
      if (licenseKey.activatedBy) {
        return;
      }

      const [person] = await db
        .insert(Persons)
        .values({
          name: input.name,
        })
        .returning();
      if (!person) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create person",
        });
      }
      const [user] = await db
        .insert(Users)
        .values({
          person: person.id,
        })
        .returning();
      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }
      await db
        .update(LicenseKeys)
        .set({
          activatedAt: new Date(),
          activatedBy: user.id,
        })
        .where(eq(LicenseKeys.key, licenseKey.key));
    })
