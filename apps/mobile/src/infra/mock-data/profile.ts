import type { UserProfile } from "~/compat/mobile-v0";

const initialLicenseKey =
  process.env.EXPO_PUBLIC_E2E_SCENARIO === "startup" ? "" : "STUB-U123-2026-UI00";

export const profileSeed: UserProfile = {
  name: "Hauke",
  isOfAge: false,
  yearId: "y12",
  classId: "c12a",
  schoolName: "IGS Lilienthal",
  licenseKey: initialLicenseKey,
};
