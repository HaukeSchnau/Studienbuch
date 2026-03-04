import { SCHOOL_IDS } from "@stu/lib";

const printRootHelp = () => {
  console.log(`Studienbuch Console v1.0.0

Usage:
  console <command> [options]

Commands:
  pull --school=<${SCHOOL_IDS.join("|")}>
  legacy-import
  generate-licenses --school=<${SCHOOL_IDS.join("|")}> [--count=<number>]
  prune-conflicts
  bootstrap-broadcast
  help`);
};

const printCommandHelp = (command: string) => {
  switch (command) {
    case "pull":
      console.log(`Usage: console pull --school=<${SCHOOL_IDS.join("|")}>`);
      return;
    case "legacy-import":
      console.log("Usage: console legacy-import");
      return;
    case "generate-licenses":
      console.log(`Usage: console generate-licenses --school=<${SCHOOL_IDS.join("|")}> [--count=<number>]`);
      return;
    case "prune-conflicts":
      console.log("Usage: console prune-conflicts");
      return;
    case "bootstrap-broadcast":
      console.log("Usage: console bootstrap-broadcast");
      return;
    default:
      printRootHelp();
  }
};

const maybeHandleHelpWithoutRuntime = (rawArgv: readonly string[]) => {
  const argv = [...rawArgv];
  if (argv[0] === "--") {
    argv.shift();
  }

  const [command] = argv;
  const helpRequested = argv.includes("--help") || argv.includes("-h");

  if (!command || command === "help") {
    printRootHelp();
    return true;
  }

  if (helpRequested) {
    printCommandHelp(command);
    return true;
  }

  return false;
};

if (maybeHandleHelpWithoutRuntime(process.argv.slice(2))) {
  process.exit(0);
}

const { runConsole } = await import("./console-command");
runConsole(process.argv);
