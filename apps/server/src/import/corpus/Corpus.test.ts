import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { TinySchool } from "../evaluation/TinySchool.ts";
import { Corpus } from "./Corpus.ts";

layer(NodeServices.layer)("Corpus", (it) => {
  it.effect("reads back the corpus it wrote to a directory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();

      yield* Corpus.write(directory, TinySchool.corpus);

      assert.deepStrictEqual(yield* Corpus.read(directory), TinySchool.corpus);
    }),
  );
});
