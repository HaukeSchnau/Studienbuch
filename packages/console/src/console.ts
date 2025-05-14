import { program } from "@commander-js/extra-typings";
import { z } from "zod";

import { SYSTEM_USER, ingest } from "@stu/api";
import { db } from "@stu/db/client";
import { Schools } from "@stu/db/schema";
import { Result, SCHOOL_IDS, defaultSchools } from "@stu/lib";

import { importClasses } from "./import-classes";
import { importTeachers } from "./import-teachers";
import { importTimetable } from "./import-timetable";
import { logger } from "./logger";
import { addSemesters } from "./seed/add-semesters";
import { generateLicenses } from "./seed/generate-licenses";

process.on("SIGINT", () => {
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});

program
  .name("console")
  .description("Studienbuch Console")
  .showSuggestionAfterError();

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
    await importTimetable({
      school,
      date: new Date(),
      monthOffsetRange: [-2, 2],
    });

    logger.info("Seeding complete!");
    process.exit(0);
  });

program
  .command("pull")
  .argument("<school>", "School ID", (val) => z.enum(SCHOOL_IDS).parse(val))
  .action(async (school) => {
    const defaultSchoolValue = defaultSchools[school];
    logger.info("Pulling data...");
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
    await importTeachers();
    await addSemesters(defaultSchoolValue.stateCode);
    await importClasses({ school });
    await importTimetable({
      school,
      date: new Date(),
      monthOffsetRange: [-2, 2],
    });
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
    await importTimetable({
      school,
      date: new Date(),
      monthOffsetRange: [-4, 4],
    });

    process.exit(0);
  });

program
  .command("generate-licenses")
  .argument("<number>", "Number of licenses to generate", Number.parseInt)
  .argument("<school>", "School ID", (val) => z.enum(SCHOOL_IDS).parse(val))
  .action(async (number, school) => {
    if (Number.isNaN(number)) program.error("Number must be a number");
    if (number < 1) program.error("Number must be greater than 0");

    logger.info(`Generating ${number} licenses...`);
    await generateLicenses(number, school);

    process.exit(0);
  });

program.parse();
