/**
 * A corpus directory as one file, `tar`, zstd and age, like `tar --zstd -c | age -r` (m2-import-corpus.md,
 * section 5). Node's zlib compresses and typage encrypts, so neither the dev hosts nor CI need an
 * age or zstd binary.
 */
import * as NodeStream from "@effect/platform-node/NodeStream";
import * as Age from "age-encryption";
import type * as Arr from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Tar from "effect/encoding/Tar";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as NodeZlib from "node:zlib";

export * as Archive from "./Archive.ts";

/**
 * Hauke's age recipient, the one `.sops.yaml` names for `secrets/`. The raw capture is encrypted
 * to it alone.
 */
export const owner = "age18q0vl05uxfugy0wemxwgd5y0rnrcxw9l5srkf3nhhf3ju4klufhq9vcwk3";

export class ArchiveFailed extends Schema.TaggedError<
  ArchiveFailed,
  { readonly brand: unique symbol }
>()("Archive.ArchiveFailed", { reason: Schema.String }) {}

const failed = (reason: string) => () => new ArchiveFailed({ reason });

/** Every file below `directory`, relative and in order. */
const filesIn = Effect.fn("Archive.filesIn")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const all = yield* fs.readDirectory(directory, { recursive: true });

  const files = yield* Effect.filter(all, (file) =>
    Effect.map(fs.stat(path.join(directory, file)), (info) => info.type === "File"),
  );

  return files.map((file) => file.split(path.sep).join("/")).toSorted();
});

/** Packs `directory` into `file` for `recipients`, through a partial file renamed at the end. */
export const pack = Effect.fn("Archive.pack")(function* (
  directory: string,
  file: string,
  recipients: Arr.NonEmptyReadonlyArray<string>,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const encrypter = new Age.Encrypter();

  for (const recipient of recipients) {
    yield* Effect.try({
      try: () => encrypter.addRecipient(recipient),
      catch: failed("a recipient isn't an age recipient"),
    });
  }

  const tar = Stream.fromIterable(yield* filesIn(directory)).pipe(
    Stream.mapEffect((name) =>
      Effect.map(fs.readFile(path.join(directory, name)), (bytes) => Tar.file(name, bytes)),
    ),
    Stream.pipeThroughChannel(Tar.encode()),
    NodeStream.pipeThroughSimple(() => NodeZlib.createZstdCompress()),
  );

  const plain = yield* Stream.toReadableStreamEffect(tar);

  const sealed = yield* Effect.tryPromise({
    try: () => encrypter.encrypt(plain),
    catch: failed("age couldn't encrypt the archive"),
  });

  const partial = `${file}.partial`;

  yield* fs.makeDirectory(path.dirname(file), { recursive: true });
  yield* Stream.run(
    Stream.fromReadableStream({
      evaluate: () => sealed,
      onError: failed("the archive stream failed"),
    }),
    fs.sink(partial),
  );
  yield* fs.rename(partial, file);
});

/** A path an archive may write: relative, below its directory, and nothing but names. */
const safe = (name: string) =>
  name !== "" &&
  !name.startsWith("/") &&
  name.split("/").every((part) => part !== "" && part !== "." && part !== "..");

/** Unpacks `file` into `directory` with the first of `identities` that opens it. */
export const unpack = Effect.fn("Archive.unpack")(function* (
  file: string,
  directory: string,
  identities: ReadonlyArray<string>,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const decrypter = new Age.Decrypter();

  for (const identity of identities) {
    yield* Effect.try({
      try: () => decrypter.addIdentity(identity),
      catch: failed("an identity isn't an age identity"),
    });
  }

  const sealed = yield* Stream.toReadableStreamEffect(fs.stream(file));

  const plain = yield* Effect.tryPromise({
    try: () => decrypter.decrypt(sealed),
    catch: failed("no identity opens the archive"),
  });

  yield* Stream.fromReadableStream({
    evaluate: () => plain,
    onError: failed("the archive doesn't decrypt"),
  }).pipe(
    NodeStream.pipeThroughSimple(() => NodeZlib.createZstdDecompress()),
    Stream.pipeThroughChannel(Tar.decode()),
    Stream.runForEach((entry) =>
      Effect.gen(function* () {
        const name = entry.header.path;

        if (entry.header.type === "Directory") return;

        if (entry.header.type !== "File" || !safe(name)) {
          return yield* new ArchiveFailed({ reason: "the archive holds an entry it may not" });
        }

        const target = path.join(directory, ...name.split("/"));

        yield* fs.makeDirectory(path.dirname(target), { recursive: true });
        yield* Stream.run(entry.body, fs.sink(target));
      }),
    ),
  );
});

/** The age identities in a key file such as SOPS's `keys.txt`, without its comments. */
export const identitiesIn = Effect.fn("Archive.identitiesIn")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(file);

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("AGE-SECRET-KEY-"));
});

/** The SHA-256 of a file in hex, which pins an archive. */
export const sha256 = Effect.fn("Archive.sha256")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const crypto = yield* Crypto.Crypto;

  return Hex.encode(yield* crypto.digest("SHA-256", yield* fs.readFile(file)));
});
