import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";
import * as ChildProcess from "effect/unstable/process/ChildProcess";

export class CommandFailedError extends Schema.TaggedError<CommandFailedError>()(
  "CommandFailedError",
  {
    command: Schema.String,
    exitCode: Schema.Int,
  },
) {
  override get message(): string {
    return `${this.command} exited with code ${this.exitCode}.`;
  }
}

const runCommand = Effect.fn("Script.command")(function* (
  executable: string,
  args: ReadonlyArray<string>,
) {
  const child = yield* ChildProcess.make(executable, args, {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = Number(yield* child.exitCode);

  if (exitCode !== 0) {
    return yield* new CommandFailedError({ command: executable, exitCode });
  }
}, Effect.scoped);

interface CommandFallback {
  readonly executable: string;
  readonly args?: ReadonlyArray<string>;
}

interface CommandOptions {
  readonly fallback?: CommandFallback;
}

type ScriptCommand = (
  templates: TemplateStringsArray,
  ...expressions: ReadonlyArray<ChildProcess.TemplateExpression>
) => ReturnType<typeof runCommand>;

function isExecutableMissing(error: unknown): error is PlatformError.PlatformError {
  return error instanceof PlatformError.PlatformError && error.reason._tag === "NotFound";
}

function parseArguments(
  templates: TemplateStringsArray,
  expressions: ReadonlyArray<ChildProcess.TemplateExpression>,
): ReadonlyArray<string> {
  const parsed = ChildProcess.make(templates, ...expressions);
  return parsed.command === "" ? parsed.args : [parsed.command, ...parsed.args];
}

export function command(executable: string, options: CommandOptions = {}): ScriptCommand {
  return (
    templates: TemplateStringsArray,
    ...expressions: ReadonlyArray<ChildProcess.TemplateExpression>
  ) => {
    const args = parseArguments(templates, expressions);
    const primary = runCommand(executable, args);

    if (options.fallback === undefined) {
      return primary;
    }

    const fallback = options.fallback;
    return primary.pipe(
      Effect.catchIf(isExecutableMissing, () =>
        runCommand(fallback.executable, [...(fallback.args ?? []), ...args]),
      ),
    );
  };
}

export function runMain<A, E>(program: Effect.Effect<A, E, NodeServices.NodeServices>): void {
  NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
}
