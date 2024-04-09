import { exec as execCb } from "child_process";
import { promisify } from "util";
import { program } from "@commander-js/extra-typings";

import { db } from "@schnau/db";
import { findAbbrvName, loginIserv } from "@schnau/external-api";
import { createUser } from "@schnau/lib-server";

import { copySubstitutions } from "./copyKadmosSubstitutions";
import { generateDartClient } from "./dartGenerator/generateDartClient";
import { generateLicenses } from "./seed/generateLicenses";

const exec = promisify(execCb);

program
  .name("console")
  .description("Studienbuch Console")
  .showSuggestionAfterError();

program.command("copy-substitutions").action(async () => {
  console.log("Copying today's substitutions...");
  await copySubstitutions("TODAY");
  console.log("Copying tomorrow's substitutions...");
  await copySubstitutions("TOMORROW");
});

program
  .command("create-user")
  .argument("<username>", "Username of the new user")
  .argument("[email]", "Email of the new user")
  .argument("[password]", "Password of the new user")
  .action(async (username, email, password) => {
    console.log(`Creating user "${username}"...`);
    await createUser(username, email, password);
    console.log(`User "${username}" created!`);
  });

program
  .command("generate-licenses")
  .argument("<number>", "Number of licenses to generate", parseInt)
  .action(async (number) => {
    if (isNaN(number)) program.error("Number must be a number");
    if (number < 1) program.error("Number must be greater than 0");

    console.log(`Generating ${number} licenses...`);
    await generateLicenses(number);
  });

program
  .command("generate-dart-client")
  .argument("<fileName>", "Name of the that contains the AppRouter type export")
  .argument("<outputDir>", "Directory to output the generated dart files")
  .action(async (fileName, outputDir) => {
    await generateDartClient(fileName, outputDir);

    await exec(`dart format ${outputDir}`);
  });

program
  .command("find-abbrv-name")
  .argument("<abbrv>", "Abbreviation of the user")
  .action(async (abbrv) => {
    console.log(`Finding name for abbreviation "${abbrv}"...`);
    const makeRequest = await loginIserv("hauke.schnau", "yXPTd26D5");
    const result = await findAbbrvName(makeRequest, abbrv);
    console.log(result);

    process.exit(0);
  });

program.command("add-names-to-existing-users").action(async () => {
  console.log("Adding names to existing users...");

  // const users =
  //   await db.$queryRaw`SELECT * FROM "public"."User" WHERE "name" = "abbrv";`;
  // const parsedUsers = z
  //   .array(
  //     z.object({
  //       id: z.number(),
  //       abbrv: z.string(),
  //     }),
  //   )
  //   .parse(users);

  const parsedUsers = await db.user.findMany({
    select: {
      id: true,
      abbrv: true,
    },
    where: {
      abbrv: {
        not: null,
      },
    },
  });

  for (const user of parsedUsers) {
    if (!user.abbrv) throw new Error("User has no abbreviation");
    const makeRequest = await loginIserv("hauke.schnau", "yXPTd26D5");
    const result = await findAbbrvName(makeRequest, user.abbrv);
    if (!result) {
      console.error(`Could not find name for abbreviation "${user.abbrv}"`);
      continue;
    }

    await db.user.update({
      where: {
        id: user.id,
      },
      data: {
        name: result.name,
        email: result.email,
      },
    });
  }

  console.log("Names added to existing users!");
});

program.parse();
