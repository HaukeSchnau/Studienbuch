import { copyIservUsers } from "./copyIservUsers";
import { generateDummyCourses } from "./dummyCourses";
import { generateLicenses } from "./generateLicenses";

export const seed = async () => {
  await generateLicenses(100);
  await copyIservUsers();
  await generateDummyCourses();
};

void seed();
