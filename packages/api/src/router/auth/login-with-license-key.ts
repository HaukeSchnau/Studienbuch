import { z } from "zod";

import { createSession } from "@stu/auth/src/session";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { LicenseKeys } from "@stu/db/schema";

import { publicProcedure } from "../../procedures";

export const loginWithLicenseKey = publicProcedure
  .input(
    z.object({
      licenseKey: z.string(),
    }),
  )
  .mutation(async ({ input: { licenseKey } }) => {
    const license = await db.query.LicenseKeys.findFirst({
      where: eq(LicenseKeys.key, licenseKey),
      with: {
        activatedBy: {
          with: {
            person: true,
          },
        },
      },
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
          message: "Für diesen Lizenzschlüssel wurde kein Nutzer gefunden",
        },
      };
    }

    const session = await createSession({
      id: license.activatedBy.id,
      name: license.activatedBy.person.name,
      isSuperUser: license.activatedBy.isSuperUser,
    });

    return {
      session: session,
    };
  });
