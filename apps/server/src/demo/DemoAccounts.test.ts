import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, layer } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { SecretFiles } from "../infra/config/SecretFiles.ts";
import { DemoAccounts } from "./DemoAccounts.ts";

const secret = "a password long enough for review";

/** `DEMO_PASSWORD` as `prepare` reads it, from a secret file when `file` holds its content. */
const read = Effect.fn("DemoAccountsTest.read")(function* (
  env: Record<string, string>,
  file?: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* fs.makeTempFileScoped();

  if (file !== undefined) yield* fs.writeFileString(path, file);

  const provider = yield* SecretFiles.provider(
    ConfigProvider.fromEnv({ env: file === undefined ? env : { DEMO_PASSWORD_FILE: path } }),
  );

  return yield* DemoAccounts.password.parse(provider);
});

interface Refused {
  readonly name: string;
  readonly env: Record<string, string>;
  readonly file?: string;
  /** What the error must not contain. */
  readonly value: string;
}

const refused: ReadonlyArray<Refused> = [
  { name: "a blank secret file", env: {}, file: " \n", value: "" },
  { name: "a short password", env: { DEMO_PASSWORD: "too-short-15chr" }, value: "too-short-15chr" },
  { name: "blanks around it", env: { DEMO_PASSWORD: ` ${secret} ` }, value: secret },
];

describe("DemoAccounts.password", () => {
  layer(NodeServices.layer)((it) => {
    it.effect.each(refused)("refuses $name without printing it", ({ env, file, value }) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(read(env, file));

        expect([error._tag, value === "" || !String(error).includes(value)]).toEqual([
          "ConfigError",
          true,
        ]);
      }),
    );

    it.effect("reads a password of 16 or more characters, and none when it is unset", () =>
      Effect.gen(function* () {
        const password = (env: Record<string, string>, file?: string) =>
          Effect.map(read(env, file), Option.map(Redacted.value));

        expect([
          yield* password({ DEMO_PASSWORD: secret }),
          yield* password({}, `${secret}\n`),
          yield* password({}),
        ]).toEqual([Option.some(secret), Option.some(secret), Option.none()]);
      }),
    );
  });
});
