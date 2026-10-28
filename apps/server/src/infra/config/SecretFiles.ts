import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

/**
 * Reads every variable `NAME` from the file named by `NAME_FILE` when that is set, and from `env`
 * otherwise. Systemd credentials, Docker and Kubernetes secrets and plain variables then all work
 * unchanged (ADR 0004).
 */
export const provider = Effect.fn("SecretFiles.provider")(function* (
  env: ConfigProvider.ConfigProvider,
) {
  const fs = yield* FileSystem.FileSystem;

  const files = ConfigProvider.make((path) =>
    Effect.flatMap(env.load([...path, "FILE"]), (node) =>
      node?._tag === "Value"
        ? fs.readFileString(node.value).pipe(
            Effect.map((content) => ConfigProvider.makeValue(content.trim())),
            Effect.mapError(
              (cause) =>
                new ConfigProvider.SourceError({
                  message: `Cannot read ${path.join("_")}_FILE at ${node.value}`,
                  cause,
                }),
            ),
          )
        : // ConfigProvider.make needs `Node | undefined`, and Effect.void is typed `void`.
          // oxlint-disable-next-line effecttsgo/effect-succeed-with-void -- see above
          Effect.succeed(undefined),
    ),
  );

  return ConfigProvider.orElse(files, env);
});

/** The process environment, with `*_FILE` secrets. */
export const layer = ConfigProvider.layer(provider(ConfigProvider.fromEnv()));

export * as SecretFiles from "./SecretFiles.ts";
