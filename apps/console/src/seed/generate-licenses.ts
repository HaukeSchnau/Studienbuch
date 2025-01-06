import crypto from "crypto";

import type { SchoolId } from "@stu/lib";
import { db } from "@stu/db/client";
import { LicenseKeys } from "@stu/db/schema";

import { logger } from "../logger";

function generateLicenseKey(): string {
  return crypto
    .randomBytes(8)
    .toString("hex")
    .toUpperCase()
    .replace(/(.{4})/g, "$1-")
    .slice(0, -1);
}

export const generateLicenses = async (
  numberOfLicenses: number,
  school: SchoolId,
) => {
  logger.info(`Generating ${numberOfLicenses} license keys for school "${school}".
    ..`);

  for (let i = 0; i < numberOfLicenses; i++) {
    const licenseKey =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- We may have more schools in the future
      i == 0 && school === "igs-lil"
        ? "KJ27-MP16-LS14-JM22"
        : generateLicenseKey();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const data = {
      key: licenseKey,
      expiresAt: i == 0 ? null : expiresAt,
      isSuperKey: i == 0,
      school,
    };

    await db.insert(LicenseKeys).values(data).onConflictDoUpdate({
      target: LicenseKeys.key,
      set: data,
    });
  }

  logger.info(`Generated ${numberOfLicenses} licenses.`);
};
