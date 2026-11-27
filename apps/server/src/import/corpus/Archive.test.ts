import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, layer } from "@effect/vitest";
import * as Age from "age-encryption";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as NodeURL from "node:url";
import { TinySchool } from "../evaluation/TinySchool.ts";
import { Archive } from "./Archive.ts";
import { Corpus } from "./Corpus.ts";

layer(NodeServices.layer)("Archive", (it) => {
  it.effect("opens for its recipients only, and gives back the corpus it packed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const identity = yield* Effect.promise(() => Age.generateIdentity());
      const recipient = yield* Effect.promise(() => Age.identityToRecipient(identity));
      const stranger = yield* Effect.promise(() => Age.generateIdentity());

      yield* Corpus.write(path.join(root, "corpus"), TinySchool.corpus);
      yield* Archive.pack(path.join(root, "corpus"), path.join(root, "corpus.age"), [
        Archive.owner,
        recipient,
      ]);

      const sealed = yield* fs.readFileString(path.join(root, "corpus.age"), "latin1");

      assert.isTrue(sealed.startsWith("age-encryption.org/v1"));
      assert.notInclude(sealed, "Lehrkraft");

      yield* Archive.unpack(path.join(root, "corpus.age"), path.join(root, "out"), [identity]);
      assert.deepStrictEqual(yield* Corpus.read(path.join(root, "out")), TinySchool.corpus);

      const refused = yield* Effect.flip(
        Archive.unpack(path.join(root, "corpus.age"), path.join(root, "nope"), [stranger]),
      );

      assert.deepStrictEqual(
        refused._tag === "Archive.ArchiveFailed" ? refused.reason : refused._tag,
        "no identity opens the archive",
      );
    }),
  );

  it.effect("encrypts to the recipient .sops.yaml names for secrets", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const sops = NodeURL.fileURLToPath(new URL("../../../../../.sops.yaml", import.meta.url));

      assert.include(yield* fs.readFileString(sops), `age: ${Archive.owner}`);
    }),
  );
});
