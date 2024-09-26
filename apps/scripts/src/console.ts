import { program } from "@commander-js/extra-typings";
import { add, format } from "date-fns";
import { z } from "zod";

import { db } from "@stu/db/client";
import { Schools } from "@stu/db/schema";
import { defaultSchools, SCHOOL_IDS } from "@stu/lib";
import {
  createUser,
  importClasses,
  importTeachers,
  importTimetable,
} from "@stu/lib-server";

import { addSemesters } from "./seed/add-semesters";
import { copySubstitutions } from "./seed/copy-kadmos-substitutions";
import { generateLicenses } from "./seed/generate-licenses";

program
  .name("console")
  .description("Studienbuch Console")
  .showSuggestionAfterError();

program
  .command("seed")
  .argument("<school>", "School ID", (val) => z.enum(SCHOOL_IDS).parse(val))
  .action(async (school) => {
    const defaultSchoolValue = defaultSchools[school];

    console.log(`Seeding school "${school}"...`);
    await db
      .insert(Schools)
      .values({ id: school, ...defaultSchoolValue })
      .onConflictDoNothing();

    console.log(`Generating license keys for school "${school}"...`);
    await generateLicenses(100, school);

    console.log("Importing teachers...");
    await importTeachers();

    console.log("Adding semesters...");
    await addSemesters(defaultSchoolValue.stateCode);

    console.log("Importing classes...");
    await importClasses({ school });

    console.log("Seeding complete!");
    process.exit(0);
  });

program.command("import-substitutions").action(async () => {
  console.log("Copying today's substitutions...");
  await copySubstitutions("igs-lil", "TODAY");
  console.log("Copying tomorrow's substitutions...");
  await copySubstitutions("igs-lil", "TOMORROW");

  process.exit(0);
});

program.command("import-teachers").action(async () => {
  console.log("Importing teachers...");
  await importTeachers();
  process.exit(0);
});

program.command("import-classes").action(async () => {
  console.log("Copying classes...");
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

  console.log(await db.query.Semesters.findMany());

  process.exit(0);
});

program.command("import-timetable").action(async () => {
  const today = new Date();
  for (let i = -4; i < 4; i++) {
    const date = add(today, { weeks: i });
    console.log(`Importing timetable for ${format(date, "yyyy-MM-dd")}...`);
    await importTimetable({ school: "igs-lil", date });
  }

  process.exit(0);
});

program
  .command("create-user")
  .argument("<username>", "Username of the new user")
  .argument("[email]", "Email of the new user")
  .argument("[password]", "Password of the new user")
  .action(async (username, email, password) => {
    console.log(`Creating user "${username}"...`);
    await createUser({
      name: username,
      email,
      password,
    });
    console.log(`User "${username}" created!`);

    process.exit(0);
  });

program
  .command("generate-licenses")
  .argument("<number>", "Number of licenses to generate", parseInt)
  .argument("<school>", "School ID", (val) => z.enum(SCHOOL_IDS).parse(val))
  .action(async (number, school) => {
    if (isNaN(number)) program.error("Number must be a number");
    if (number < 1) program.error("Number must be greater than 0");

    console.log(`Generating ${number} licenses...`);
    await generateLicenses(number, school);

    process.exit(0);
  });

program.parse();
