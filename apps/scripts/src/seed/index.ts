import { seedUsers } from "./seedUsers";
import { generateDummyCourses } from "./dummyCourses";
import { generateLicenses } from "./generateLicenses";

export const seed = async () => {
  await generateLicenses(100);
  await seedUsers();
  await generateDummyCourses();
};

void seed();
