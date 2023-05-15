import { generateLicenses } from "./generateLicenses";
import { seedClasses } from "./seedClasses";
import { seedUsers } from "./seedUsers";

export const seed = async () => {
  await generateLicenses(100);
  // await seedUsers();
  await seedClasses();
};

void seed();
