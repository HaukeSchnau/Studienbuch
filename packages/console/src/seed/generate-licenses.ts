import crypto from "node:crypto";

import { ingestEffect } from "@stu/api";
import type { SchoolId } from "@stu/lib";
import { DateTime, Effect } from "effect";

function generateLicenseKey(): string {
  return crypto
    .randomBytes(8)
    .toString("hex")
    .toUpperCase()
    .replace(/(.{4})/g, "$1-")
    .slice(0, -1);
}

const oneYearFromNow = DateTime.now.pipe(Effect.andThen(DateTime.add({ years: 1 })));

export const generateLicenses = Effect.fn(function* (numberOfLicenses: number, school: SchoolId) {
  yield* Effect.logInfo(`Generating ${numberOfLicenses} license keys for school "${school}".
    ..`);

  const expiresAt = yield* oneYearFromNow;

  const keys: string[] = [];
  for (let i = 0; i < numberOfLicenses; i++) {
    const licenseKey =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- We may have more schools in the future
      i === 0 && school === "igs-lil" ? "KJ27-MP16-LS14-JM22" : generateLicenseKey();

    keys.push(licenseKey);

    yield* ingestEffect({
      type: "auth.licenseGenerated",
      data: {
        school,
        licenseKey,
        expiryDate: expiresAt.pipe(DateTime.toDate),
      },
    }).pipe(
      Effect.catchIf(
        (error) => error.reason === "DUPLICATE",
        () => Effect.logInfo(`License key ${licenseKey} already generated!`),
      ),
    );
  }

  yield* Effect.logInfo(`Generated ${numberOfLicenses} licenses.`);

  return keys;
});
