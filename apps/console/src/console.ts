import "./instrument";

import { program } from "@commander-js/extra-typings";
import { add, format, weeksToDays } from "date-fns";
import { z } from "zod";

import { SYSTEM_USER, ingest } from "@stu/api";
import { db } from "@stu/db/client";
import { Schools } from "@stu/db/schema";
import type { SchoolId } from "@stu/lib";
import { Result, SCHOOL_IDS, defaultSchools } from "@stu/lib";
import { createUser } from "@stu/lib-server";

import { importClasses } from "./import-classes";
import { importTeachers } from "./import-teachers";
import { importTimetable } from "./import-timetable";
import { logger } from "./logger";
import { addSemesters } from "./seed/add-semesters";
import { generateLicenses } from "./seed/generate-licenses";

program
  .name("console")
  .description("Studienbuch Console")
  .showSuggestionAfterError();

const clamp = (min: number, max: number, value: number) => {
  return Math.min(Math.max(min, value), max);
};

const importTimetables = async ({
  school,
  weekOffsetRange: [offsetStart, offsetEnd],
}: {
  school: SchoolId;
  weekOffsetRange: [number, number];
}) => {
  const today = new Date();
  logger.info(
    `Importing timetables for school "${school}" from ${format(
      add(today, { days: weeksToDays(offsetStart) }),
      "yyyy-MM-dd",
    )} to ${format(
      add(today, { days: weeksToDays(offsetEnd) }),
      "yyyy-MM-dd",
    )}...`,
  );

  for (
    let i = clamp(offsetStart, offsetEnd, 0), dir = Math.sign(offsetStart);
    i <= offsetEnd;
    i += dir
  ) {
    const date = add(today, { days: weeksToDays(i) });
    logger.info(`Importing timetable for ${format(date, "yyyy-MM-dd")}...`);
    await importTimetable({ school, date });

    if (i === offsetStart && dir === -1) {
      i = 0;
      dir = 1;
    }
  }
};

program
  .command("seed")
  .argument("<school>", "School ID", (val) => z.enum(SCHOOL_IDS).parse(val))
  .action(async (school) => {
    const defaultSchoolValue = defaultSchools[school];

    logger.info(`Seeding school "${school}"...`);
    const err = await ingest(
      "org.school.founded",
      {
        data: {
          id: school,
          name: defaultSchoolValue.name,
          state: defaultSchoolValue.stateCode,
        },
        id: crypto.randomUUID(),
        timestamp: defaultSchoolValue.founded,
      },
      SYSTEM_USER,
    );
    if (Result.isErr(err)) {
      if (err.error === "EXISTS") {
        logger.debug(`School "${school}" already founded!`);
      } else {
        logger.error(`Could not ingest school founded event: ${err.error}`);
      }
    } else {
      logger.info(`School "${school}" founded!`);
    }

    await generateLicenses(10, school);
    await importTeachers();
    await addSemesters(defaultSchoolValue.stateCode);
    await importClasses({ school });
    await importTimetables({ school, weekOffsetRange: [-2, 26] });

    logger.info("Seeding complete!");
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
      firstName: username,
      lastName: username,
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
