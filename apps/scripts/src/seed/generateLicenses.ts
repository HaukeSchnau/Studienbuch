import crypto from "crypto";

import { db } from "@acme/db";

function generateLicenseKey(): string {
  return crypto
    .randomBytes(8)
    .toString("hex")
    .toUpperCase()
    .replace(/(.{4})/g, "$1-")
    .slice(0, -1);
}

export const generateLicenses = async (numberOfLicenses: number) => {
  for (let i = 0; i < numberOfLicenses; i++) {
    const licenseKey = i == 0 ? "KJ27-MP16-LS14-JM22" : generateLicenseKey();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const data = {
      key: licenseKey,
      expiresAt: i == 0 ? null : expiresAt,
      isSuperKey: i == 0,
    };

    await db.licenseKey.upsert({
      where: {
        key: licenseKey,
      },
      update: data,
      create: data,
    });
  }

  console.log(`Generated ${numberOfLicenses} licenses.`);
};
