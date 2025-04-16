import crypto from "crypto";

import { SYSTEM_USER, ingest } from "@stu/api";
import type { SchoolId } from "@stu/lib";
import { Result } from "@stu/lib";

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

    const res = await ingest(
      "auth.licenseGenerated",
      {
        data: {
          school,
          licenseKey,
          expiryDate: expiresAt,
        },
        timestamp: new Date(),
        id: crypto.randomUUID(),
      },
      SYSTEM_USER,
    );

    if (Result.isErr(res)) {
      if (res.error === "EXISTS") {
        logger.debug(`License key ${licenseKey} already generated!`);
      } else {
        logger.error(`Could not ingest license generated event: ${res.error}`);
      }
    }
  }

  logger.info(`Generated ${numberOfLicenses} licenses.`);
};
