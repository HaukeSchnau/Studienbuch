import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, layer } from "@effect/vitest";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { SecretFiles } from "./SecretFiles.ts";

layer(NodeServices.layer)("SecretFiles", (it) => {
  it.effect("reads NAME from NAME_FILE when it is set, and from NAME otherwise", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* fs.makeTempFileScoped();
      yield* fs.writeFileString(file, "from-file\n");
      const provider = yield* SecretFiles.provider(
        ConfigProvider.fromEnv({
          env: { AUTH_SECRET: "from-env", AUTH_SECRET_FILE: file, PORT: "4000" },
        }),
      );
      const config = yield* Config.all([Config.String("AUTH_SECRET"), Config.Port("PORT")]).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider),
      );
      assert.deepStrictEqual(config, ["from-file", 4000]);
    }),
  );
});
