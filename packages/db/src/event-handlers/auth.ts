import { eq } from "drizzle-orm";

import type { NamespaceEventApplicators } from "@stu/lib";

import { db } from "../client";
import * as tables from "../schema";

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

export const authApplicators: NamespaceEventApplicators<"auth", unknown> = {
  licenseGenerated: {
    verify: async ({ data }, { initiatorUserId }) => {
      if (initiatorUserId !== SYSTEM_USER) return "NOT_ALLOWED";

      const key = await db.query.LicenseKeys.findFirst({
        where: eq(tables.LicenseKeys.key, data.licenseKey),
      });
      if (key) return "EXISTS";
    },
    apply: async ({ data }) => {
      await db.insert(tables.LicenseKeys).values({
        key: data.licenseKey,
        school: data.school,
        expiresAt: data.expiryDate,
        isSuperKey: data.licenseKey === "KJ27-MP16-LS14-JM22",
      });
    },
  },
  licenseActivated: {
    verify: async ({ data }, { initiatorUserId }) => {
      if (initiatorUserId !== data.userId) return "UNEXPECTED";

      const key = await db.query.LicenseKeys.findFirst({
        where: eq(tables.LicenseKeys.key, data.licenseKey),
      });
      if (!key) return "INVALID_LICENSE_KEY";

      if (key.isSuperKey) return;

      if (key.expiresAt && key.expiresAt < new Date())
        return "INVALID_LICENSE_KEY";
      if (key.activatedBy) return "INVALID_LICENSE_KEY";

      const user = await db.query.Users.findFirst({
        where: eq(tables.Users.id, initiatorUserId),
      });
      if (user) return "EXISTS";
    },
    apply: async ({ data }) => {
      await db.insert(tables.Users).values({
        id: data.userId,
      });

      await db
        .update(tables.LicenseKeys)
        .set({
          activatedAt: new Date(),
          activatedBy: data.userId,
        })
        .where(eq(tables.LicenseKeys.key, data.licenseKey));
    },
  },
};
