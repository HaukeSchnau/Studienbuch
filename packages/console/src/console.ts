import { program } from "@commander-js/extra-typings";
import { bootstrapBroadcastAsync, ingest, SYSTEM_USER } from "@stu/api";
import { alias, and, eq, ne } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import { upsertCourses } from "@stu/legacy-import";
import { defaultSchools, SCHOOL_IDS } from "@stu/lib";
import { Exit } from "effect";
import { z } from "zod";
import { extractCourses } from "./extract-courses";
import { importClasses } from "./kadmos/import-classes";
import { importTeachers } from "./kadmos/import-teachers";
import { importTimetable } from "./kadmos/import-timetable";
import { getCurrentSchoolYearId, setupAuth } from "./kadmos/kadmos-utils";
import { logger } from "./logger";
import { addSemesters } from "./seed/add-semesters";
import { generateLicenses } from "./seed/generate-licenses";

process.on("SIGINT", () => {
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});

program.name("console").description("Studienbuch Console").showSuggestionAfterError();

program
  .command("pull")
  .argument("<school>", "School ID", (val) => z.enum(SCHOOL_IDS).parse(val))
  .option("--dry-run", "Only print the data that would be ingested")
  .action(async (school, { dryRun = false }) => {
    const defaultSchoolValue = defaultSchools[school];
    logger.info("Pulling data...");
    if (!dryRun) {
      const err = await ingest(
        {
          type: "org.school.founded",
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
      if (Exit.isFailure(err)) {
        if (err.cause._tag === "Fail" && err.cause.error.reason === "DUPLICATE") {
          logger.info(`School "${school}" already founded!`);
        } else {
          logger.error(`Could not ingest school founded event: ${err.cause.toString()}`);
        }
      } else {
        logger.info(`School "${school}" founded!`);
      }
    } else {
      logger.info(`School: ${JSON.stringify(defaultSchoolValue, null, 2)}`);
    }

    await generateLicenses(10, school, dryRun);

    const authContext = await setupAuth(school);
    const schoolYearId = await getCurrentSchoolYearId(authContext);
    await importTeachers({ school, schoolYearId, dryRun }, authContext);
    await addSemesters(defaultSchoolValue.stateCode, dryRun);
    await importClasses({ school, schoolYearId, dryRun }, authContext);
    await importTimetable(
      {
        school,
        date: new Date(),
        monthOffsetRange: [-2, 2],
        schoolYearId,
        dryRun,
      },
      authContext,
    );
    process.exit(0);
  });

// program.command("import-teachers").action(async () => {
//   logger.info("Importing teachers...");
//   await importTeachers();
//   process.exit(0);
// });

// program.command("import-classes").action(async () => {
//   logger.info("Copying classes...");
//   await importClasses({ school: "igs-lil" });

//   process.exit(0);
// });

// program.command("import-semesters").action(async () => {
//   const states = await db.selectDistinct({ stateCode: Schools.stateCode }).from(Schools);

//   for (const state of states) {
//     await addSemesters(state.stateCode);
//   }

//   logger.info(await db.query.Semesters.findMany());

//   process.exit(0);
// });

// program
//   .command("import-timetable")
//   .argument("<school>", "School ID", (val) => z.enum(SCHOOL_IDS).parse(val))
//   .action(async (school) => {
//     logger.info(`Importing timetables for school "${school}"...`);
//     await importTimetable({
//       school,
//       date: new Date(),
//       monthOffsetRange: [-4, 4],
//     });

//     process.exit(0);
//   });

program
  .command("generate-licenses")
  .argument("<number>", "Number of licenses to generate", Number.parseInt)
  .argument("<school>", "School ID", (val) => z.enum(SCHOOL_IDS).parse(val))
  .action(async (number, school) => {
    if (Number.isNaN(number)) program.error("Number must be a number");
    if (number < 1) program.error("Number must be greater than 0");

    logger.info(`Generating ${number} licenses...`);
    await generateLicenses(number, school, false);

    process.exit(0);
  });

program.command("extract-courses").action(async () => {
  const courses = await extractCourses();
  await upsertCourses(courses);

  process.exit(0);
});

program.command("prune-conflicts").action(async () => {
  const te1 = alias(tables.TimetableEntries, "te1");
  const te2 = alias(tables.TimetableEntries, "te2");
  const course1 = alias(tables.Courses, "course1");
  const course2 = alias(tables.Courses, "course2");
  const coursesToTeachers1 = alias(tables.CoursesToTeachers, "coursesToTeachers1");
  const coursesToTeachers2 = alias(tables.CoursesToTeachers, "coursesToTeachers2");
  // find all courses with the same teacher that have at least one overlapping time
  const conflicts = await db
    .select()
    .from(course1)
    .innerJoin(te1, eq(course1.id, te1.course))
    .innerJoin(coursesToTeachers1, eq(course1.id, coursesToTeachers1.course))
    .innerJoin(coursesToTeachers2, eq(coursesToTeachers1.teacher, coursesToTeachers2.teacher))
    .innerJoin(course2, eq(coursesToTeachers2.course, course2.id))
    .innerJoin(te2, eq(course2.id, te2.course))
    .innerJoin(tables.Persons, eq(coursesToTeachers1.teacher, tables.Persons.id))
    .where(and(eq(te1.start, te2.start), ne(course1.id, course2.id)));

  console.log(conflicts);
  process.exit(0);
});

program.command("bootstrap-broadcast").action(async () => {
  await bootstrapBroadcastAsync();
  process.exit(0);
});

program.parse();
