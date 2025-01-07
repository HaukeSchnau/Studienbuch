import { z } from "zod";

import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import { createSession } from "@stu/lib-server";

import { publicProcedure } from "../../procedures";

export const loginWithLicenseKey = publicProcedure
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

    if (!license.activatedBy) {
      return {
        error: {
          field: "licenseKey" as const,
          message: "Dieser Lizenkschlüssel wurde noch nicht aktiviert",
        },
      };
    }

    const session = await db
      .insert(tables.Sessions)
      .values(createSession({ id: license.activatedBy }))
      .returning();

    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      session: session[0]!,
    };
  });
