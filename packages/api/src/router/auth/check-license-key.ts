import { z } from "zod";

import { db, eq, tables } from "../../postgres";
import { publicProcedure } from "../../procedures";

export const checkLicenseKey = publicProcedure
  .input(
    z.object({
      licenseKey: z.string(),
    }),
  )
  .mutation(async ({ input }) => {
    const licenseKey = await db.query.licenseKeys.findFirst({
      where: eq(tables.licenseKeys.key, input.licenseKey),
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
  });
