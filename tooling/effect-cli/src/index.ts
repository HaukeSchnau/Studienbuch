import { Command as NewCommand, Flag } from "effect/unstable/cli";

type LegacyCliConfig = {
  readonly name: string;
  readonly version: string;
};

const normalizeArgv = (argv: readonly string[]): Array<string> => {
  const normalized = argv.slice(2);
  if (normalized[0] === "--") {
    normalized.shift();
  }
  return [...normalized];
};

const run = (command: unknown, config: LegacyCliConfig) => {
  const runner = NewCommand.runWith(command as never, {
    version: config.version,
  });

  return (argv: readonly string[]) => runner(normalizeArgv(argv));
};

export const Command = {
  ...NewCommand,
  run,
};

export const Options = Flag;
