import fs from "fs/promises";
import p from "path";

import { prisma } from "@acme/db";

import { getFilePath } from "../getFilePath";
import { getKnownUsers } from "./seedUtil/getKnownUsers";
import { parseScheduleCsv } from "./seedUtil/parseScheduleCsv";
import { seedSchedule } from "./seedUtil/seedSchedule";

export const seedClasses = async () => {
  // Delete all course times
  await prisma.courseTime.deleteMany({});

  const knownUsers = await getKnownUsers();

  const path = getFilePath("cache/classes_csv");
  const filenames = await fs.readdir(path);

  for (const filename of filenames.filter((filename) =>
    filename.endsWith(".csv"),
  )) {
    const scheduleInfo = await parseScheduleCsv(p.join(path, filename));

    await seedSchedule(scheduleInfo, knownUsers);
  }
  console.log("Done seeding courses");

  // Delete all courses that have no course times
  // await prisma.course.deleteMany({
  //   where: {
  //     times: {
  //       none: {},
  //     },
  //   },
  // });
  // console.log("Successfully deleted all courses that have no course times");
  //
  // // Delete all classes that have no courses
  // await prisma.class.deleteMany({
  //   where: {
  //     courses: {
  //       none: {},
  //     },
  //   },
  // });
  // console.log("Successfully deleted all classes that have no courses");
  //
  // // Delete all years that have no classes
  // await prisma.year.deleteMany({
  //   where: {
  //     classes: {
  //       none: {},
  //     },
  //   },
  // });
  // console.log("Successfully deleted all years that have no classes");
};
