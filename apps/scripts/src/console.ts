import { program } from "@commander-js/extra-typings";

import { createUser } from "@schnau/lib-server";

import { copySubstitutions } from "./copyKadmosSubstitutions";
import { generateDartClient } from "./dartGenerator/generateDartClient";
import { generateLicenses } from "./seed/generateLicenses";

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
  });

program.parse();
