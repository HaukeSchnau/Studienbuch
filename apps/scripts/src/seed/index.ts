import { generateLicenses } from "./generateLicenses";

export const seed = async () => {
  await generateLicenses(100);
};

void seed();
