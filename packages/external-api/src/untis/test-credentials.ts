export interface UntisTestCredentials {
  kadmosName: string;
  kadmosUsername: string;
  kadmosPassword: string;
}

const untisKadmosName = process.env.UNTIS_KADMOS_NAME;
const untisKadmosUsername = process.env.UNTIS_KADMOS_USERNAME;
const untisKadmosPassword = process.env.UNTIS_KADMOS_PASSWORD;

export const untisLiveTestsEnabled =
  process.env.UNTIS_LIVE_TESTS === "1" &&
  Boolean(untisKadmosName) &&
  Boolean(untisKadmosUsername) &&
  Boolean(untisKadmosPassword);

export const getUntisTestCredentials = (): UntisTestCredentials => {
  if (!untisKadmosName || !untisKadmosUsername || !untisKadmosPassword) {
    throw new Error(
      "Missing Untis test credentials. Set UNTIS_KADMOS_NAME, UNTIS_KADMOS_USERNAME, and UNTIS_KADMOS_PASSWORD.",
    );
  }

  return {
    kadmosName: untisKadmosName,
    kadmosUsername: untisKadmosUsername,
    kadmosPassword: untisKadmosPassword,
  };
};
