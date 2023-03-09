import crypto from "crypto";

import { prisma } from "@acme/db";

function generateLicenseKey(): string {
  return crypto
    .randomBytes(8)
    .toString("hex")
    .toUpperCase()
    .replace(/(.{4})/g, "$1-")
    .slice(0, -1);
}

const main = async () => {
  const numberOfLicenses = process.argv[2] || 1;

  for (let i = 0; i < numberOfLicenses; i++) {
    const licenseKey = generateLicenseKey();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const license = await prisma.licenseKey.create({
      data: {
        key: licenseKey,
        expiresAt,
      },
    });

    console.log(license);
  }
};

void main();
