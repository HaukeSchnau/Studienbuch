import { generateLicenses } from "./generateLicenses";
import { seedClasses } from "./seedClasses";

export const seed = async () => {
  await generateLicenses(100);
  await seedClasses();
};

void seed();
