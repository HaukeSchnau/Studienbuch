import { assert, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Base64 from "effect/encoding/Base64";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { IndexedDbKeychain } from "./IndexedDbKeychain.ts";
import { Keychain } from "./Keychain.ts";

const decodeSealed = Schema.decodeUnknownEffect(
  Schema.Struct({ iv: Schema.Uint8Array, data: Schema.Uint8Array }),
);

const namespace = "browser-test";
const entry = `secret.${namespace}.root-key`;

/** One page load: each run builds its store anew, so only what the store keeps carries over. */
const page = <A, E>(
  store: Layer.Layer<Keychain.Store, Keychain.Unavailable>,
  run: (secrets: Ports.DeviceSecrets["Service"]) => Effect.Effect<A, E>,
) =>
  Effect.provide(
    Ports.DeviceSecrets.use(run),
    Keychain.secrets(namespace).pipe(Layer.provide(store)),
  );

const stored = (name: string) =>
  Effect.promise(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open("studienbuch-keychain");

        open.addEventListener("error", () => reject(open.error));
        open.addEventListener("success", () => {
          const read = open.result.transaction("entries").objectStore("entries").get(name);

          read.addEventListener("error", () => reject(read.error));
          read.addEventListener("success", () => {
            open.result.close();
            resolve(read.result);
          });
        });
      }),
  );

it.effect(
  "a browser keeps a device's secrets across reloads, sealed under a key no script reads",
  () =>
    Effect.gen(function* () {
      const rootKey = crypto.getRandomValues(new Uint8Array(32));

      yield* page(IndexedDbKeychain.layer, (secrets) => secrets.set("root-key", rootKey));

      const reloaded = yield* page(IndexedDbKeychain.layer, (secrets) => secrets.get("root-key"));

      assert.deepStrictEqual(reloaded, Option.some(rootKey));

      // IndexedDB holds ciphertext under a key that can't leave WebCrypto.
      const sealed = yield* stored(entry);
      const wrappingKey = yield* stored("#wrapping-key");

      assert.instanceOf(wrappingKey, CryptoKey);
      assert.isFalse(wrappingKey instanceof CryptoKey && wrappingKey.extractable);
      const { data } = yield* decodeSealed(sealed);

      assert.notInclude(new TextDecoder().decode(data), Base64.encode(rootKey));
      assert.isTrue(
        yield* Effect.promise(() =>
          wrappingKey instanceof CryptoKey
            ? crypto.subtle.exportKey("raw", wrappingKey).then(
                () => false,
                () => true,
              )
            : Promise.resolve(false),
        ),
      );

      yield* page(IndexedDbKeychain.layer, (secrets) => secrets.remove("root-key"));

      assert.isUndefined(yield* stored(entry));
    }),
);

// A tab that only reads, as on a public computer, must leave no database behind that shows
// Studienbuch was used in this browser.
it.effect("creates its database at the first write, never by reading", () =>
  Effect.gen(function* () {
    const name = "keychain-test-reads";

    yield* Effect.callback<void>((resume) => {
      indexedDB.deleteDatabase(name).addEventListener("success", () => resume(Effect.void));
    });

    const listed = Effect.map(
      Effect.promise(() => indexedDB.databases()),
      (found) => found.some((database) => database.name === name),
    );

    yield* page(IndexedDbKeychain.named(name), (secrets) =>
      Effect.andThen(secrets.get("root-key"), secrets.remove("root-key")),
    );

    const afterReads = yield* listed;

    yield* page(IndexedDbKeychain.named(name), (secrets) =>
      secrets.set("root-key", new Uint8Array(32)),
    );

    assert.deepStrictEqual(
      { afterReads, afterWrite: yield* listed },
      {
        afterReads: false,
        afterWrite: true,
      },
    );
  }),
);
