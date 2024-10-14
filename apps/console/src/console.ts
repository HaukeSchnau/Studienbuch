import "./instrument";

import { program } from "@commander-js/extra-typings";
import { add, format, weeksToDays } from "date-fns";
import { z } from "zod";

import type { SchoolId } from "@stu/lib";
import { db } from "@stu/db/client";
import { Schools } from "@stu/db/schema";
import { defaultSchools, SCHOOL_IDS } from "@stu/lib";
import {
  createUser,
  importClasses,
  importTeachers,
  importTimetable,
} from "@stu/lib-server";

import { logger } from "./logger";
import { addSemesters } from "./seed/add-semesters";
import { copySubstitutions } from "./seed/copy-kadmos-substitutions";
import { generateLicenses } from "./seed/generate-licenses";

program
  .name("console")
  .description("Studienbuch Console")
  .showSuggestionAfterError();

const importTimetables = async ({
  school,
  weekOffsetRange,
}: {
  school: SchoolId;
  weekOffsetRange: [number, number];
}) => {
  const today = new Date();
  for (let i = weekOffsetRange[0]; i < weekOffsetRange[1]; i++) {
    const date = add(today, { days: weeksToDays(i) });
    logger.info(`Importing timetable for ${format(date, "yyyy-MM-dd")}...`);
    await importTimetable({ school, date });
  }
};

program
  .command("seed")
  .argument("<school>", "School ID", (val) => z.enum(SCHOOL_IDS).parse(val))
  .action(async (school) => {
    const defaultSchoolValue = defaultSchools[school];

    logger.info(`Seeding school "${school}"...`);
    await db
      .insert(Schools)
      .values({ id: school, ...defaultSchoolValue })
      .onConflictDoNothing();

    logger.info(`Generating license keys for school "${school}"...`);
    await generateLicenses(100, school);

    logger.info("Importing teachers...");
    await importTeachers();

    logger.info("Adding semesters...");
    await addSemesters(defaultSchoolValue.stateCode);

    logger.info("Importing classes...");
    await importClasses({ school });

    logger.info("Importing timetables...");
    await importTimetables({ school, weekOffsetRange: [-4, 4] });

    logger.info("Seeding complete!");
    process.exit(0);
  });

program.command("import-substitutions").action(async () => {
  logger.info("Copying today's substitutions...");
  await copySubstitutions("igs-lil", "TODAY");
  logger.info("Copying tomorrow's substitutions...");
  await copySubstitutions("igs-lil", "TOMORROW");

  process.exit(0);
});

program.command("import-teachers").action(async () => {
  logger.info("Importing teachers...");
  await importTeachers();
  process.exit(0);
});

program.command("import-classes").action(async () => {
  logger.info("Copying classes...");
  await importClasses({ school: "igs-lil" });

  process.exit(0);
});

program.command("import-semesters").action(async () => {
  const states = await db
    .selectDistinct({ stateCode: Schools.stateCode })
    .from(Schools);

  for (const state of states) {
    await addSemesters(state.stateCode);
  }

  logger.info(await db.query.Semesters.findMany());

  process.exit(0);
});

program
  .command("import-timetable")
  .argument("<school>", "School ID", (val) => z.enum(SCHOOL_IDS).parse(val))
  .action(async (school) => {
    logger.info(`Importing timetables for school "${school}"...`);
    await importTimetables({ school, weekOffsetRange: [-4, 4] });

    process.exit(0);
  });

program
  .command("create-user")
  .argument("<username>", "Username of the new user")
  .argument("[email]", "Email of the new user")
  .argument("[password]", "Password of the new user")
  .action(async (username, email, password) => {
    logger.info(`Creating user "${username}"...`);
    await createUser({
      name: username,
      email,
      password,
    });
    logger.info(`User "${username}" created!`);

    process.exit(0);
  });

program
  .command("generate-licenses")
  .argument("<number>", "Number of licenses to generate", parseInt)
  .argument("<school>", "School ID", (val) => z.enum(SCHOOL_IDS).parse(val))
  .action(async (number, school) => {
    if (isNaN(number)) program.error("Number must be a number");
    if (number < 1) program.error("Number must be greater than 0");

    logger.info(`Generating ${number} licenses...`);
    await generateLicenses(number, school);

    process.exit(0);
  });

program.parse();
