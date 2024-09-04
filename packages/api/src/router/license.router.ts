import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { LicenseKeys } from "@stu/db/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure } from "../procedures";
import { createRouter } from "../trpc";

export const license = createRouter({
  check: publicProcedure
    .input(
      z.object({
        licenseKey: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const licenseKey = await db.query.LicenseKeys.findFirst({
        where: eq(LicenseKeys.key, input.licenseKey),
      });
      if (!licenseKey) {
        return "INVALID" as const;
      }
      // TODO restore old logic once logout bug is fixed
      // if (licenseKey.isSuperKey) {
      //   return "VALID" as const;
      // }
      // if (licenseKey.expiresAt && licenseKey.expiresAt < new Date()) {
      //   return "EXPIRED" as const;
      // }
      // if (licenseKey.activatedAt) {
      //   return "ACTIVATED" as const;
      // }
      return "VALID" as const;
    }),
  activate: publicProcedure
    .input(
      z.object({
        licenseKey: z.string(),
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
      // if (licenseKey.activatedAt) {
      //   throw new TRPCError({
      //     code: "BAD_REQUEST",
      //     message: "License key already activated",
      //   });
      // }
      await db
        .update(LicenseKeys)
        .set({
          activatedAt: new Date(),
        })
        .where(eq(LicenseKeys.key, licenseKey.key));
    }),
});
