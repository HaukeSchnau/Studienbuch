import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
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
  options: ExecutionOptions,
) {
  const child = yield* ChildProcess.make(executable, args, {
    ...options,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = Number(yield* child.exitCode);

  if (exitCode !== 0) {
    return yield* CommandFailedError.make({ command: [executable, ...args].join(" "), exitCode });
  }
}, Effect.scoped);

interface CommandFallback {
  readonly executable: string;
  readonly args?: ReadonlyArray<string>;
}

type ExecutionOptions = Pick<ChildProcess.CommandOptions, "cwd" | "env" | "extendEnv">;

interface CommandOptions extends ExecutionOptions {
  readonly fallback?: CommandFallback;
}

type ScriptCommand = (
  templates: TemplateStringsArray,
  ...expressions: ReadonlyArray<ChildProcess.TemplateExpression>
) => ReturnType<typeof runCommand>;

type CommandExecutionError = CommandFailedError | PlatformError.PlatformError;

function isExecutableMissing(error: CommandExecutionError): error is PlatformError.PlatformError {
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
  const { fallback, ...executionOptions } = options;

  return (
    templates: TemplateStringsArray,
    ...expressions: ReadonlyArray<ChildProcess.TemplateExpression>
  ) => {
    const args = parseArguments(templates, expressions);
    const primary = runCommand(executable, args, executionOptions);

    if (fallback === undefined) {
      return primary;
    }

    return primary.pipe(
      Effect.catchIf(isExecutableMissing, () =>
        runCommand(fallback.executable, [...(fallback.args ?? []), ...args], executionOptions),
      ),
    );
  };
}

export const capture = Effect.fn("Script.capture")(function* (
  executable: string,
  args: ReadonlyArray<string>,
  options: ExecutionOptions = {},
) {
  const child = yield* ChildProcess.make(executable, args, {
    ...options,
    stdin: "inherit",
    stdout: "pipe",
    stderr: "inherit",
  });
  const [output, exitCode] = yield* Effect.all(
    [Stream.mkString(Stream.decodeText(child.stdout)), child.exitCode],
    { concurrency: "unbounded" },
  );

  if (Number(exitCode) !== 0) {
    return yield* CommandFailedError.make({
      command: [executable, ...args].join(" "),
      exitCode: Number(exitCode),
    });
  }

  return output;
}, Effect.scoped);

export function runMain<A, E>(program: Effect.Effect<A, E, NodeServices.NodeServices>): void {
  NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
}
