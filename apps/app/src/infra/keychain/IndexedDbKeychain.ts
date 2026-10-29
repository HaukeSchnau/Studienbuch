import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { Keychain } from "./Keychain.ts";

// A browser has no keychain. Each value is sealed with AES-GCM under one key per origin, which
// WebCrypto created as non-extractable and IndexedDB keeps as a key object (encryption.md,
// decision 7): page code can use it, but no script can read its bytes. The entry's name is the
// associated data, so a value moved to another name no longer opens.

export * as IndexedDbKeychain from "./IndexedDbKeychain.ts";

const databaseName = "studienbuch-keychain";
const entries = "entries";

// Never a store name: they contain no `#`.
const wrappingKeyEntry = "#wrapping-key";

const Sealed = Schema.Struct({ iv: Schema.Uint8Array, data: Schema.Uint8Array });

const decodeSealed = Schema.decodeUnknownEffect(Sealed);

const unavailable = (operation: Keychain.Unavailable["operation"]) => (cause: unknown) =>
  new Keychain.Unavailable({ operation, cause });

/** Resolves with the request's result once its transaction committed. */
const committed = <T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  request: (store: IDBObjectStore) => IDBRequest<T>,
) =>
  Effect.callback<T, DOMException | null>((resume) => {
    const transaction = database.transaction(entries, mode);
    const pending = request(transaction.objectStore(entries));

    transaction.addEventListener("complete", () => resume(Effect.succeed(pending.result)));
    transaction.addEventListener("error", () => resume(Effect.fail(transaction.error)));
    transaction.addEventListener("abort", () => resume(Effect.fail(transaction.error)));
  });

const open = Effect.callback<IDBDatabase, DOMException | null>((resume) => {
  const request = indexedDB.open(databaseName, 1);

  request.addEventListener("upgradeneeded", () => request.result.createObjectStore(entries));
  request.addEventListener("success", () => resume(Effect.succeed(request.result)));
  request.addEventListener("error", () => resume(Effect.fail(request.error)));
});

const text = new TextEncoder();
const fromBytes = new TextDecoder();

const isKey = (value: unknown): value is CryptoKey => value instanceof CryptoKey;

const make = Effect.gen(function* () {
  const database = yield* Effect.acquireRelease(open, (opened) =>
    Effect.sync(() => opened.close()),
  ).pipe(Effect.mapError(unavailable("get")));

  const read = (entry: string) =>
    committed(database, "readonly", (store): IDBRequest<unknown> => store.get(entry));

  const created = Effect.gen(function* () {
    const key = yield* Effect.promise(() =>
      crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]),
    );

    // Two tabs may start at once. Whichever adds its key first wins, and the other reads that one.
    return yield* committed(database, "readwrite", (store) =>
      store.add(key, wrappingKeyEntry),
    ).pipe(
      Effect.as(key),
      Effect.catch(() => Effect.filterOrFail(read(wrappingKeyEntry), isKey, () => null)),
    );
  });

  const wrappingKey = yield* Effect.cached(
    Effect.filterOrElse(read(wrappingKeyEntry), isKey, () => created),
  );

  const params = (name: string, iv: Uint8Array<ArrayBuffer>): AesGcmParams => ({
    name: "AES-GCM",
    iv,
    additionalData: text.encode(name),
  });

  const get = Effect.fn("IndexedDbKeychain.get")(function* (name: string) {
    const stored = yield* read(name);

    if (stored === undefined) return Option.none();

    const { iv, data } = yield* decodeSealed(stored);
    const key = yield* wrappingKey;

    const plain = yield* Effect.tryPromise(() =>
      crypto.subtle.decrypt(params(name, new Uint8Array(iv)), key, new Uint8Array(data)),
    );

    return Option.some(fromBytes.decode(plain));
  });

  const set = Effect.fn("IndexedDbKeychain.set")(function* (name: string, value: string) {
    const key = yield* wrappingKey;
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const data = yield* Effect.tryPromise(() =>
      crypto.subtle.encrypt(params(name, iv), key, text.encode(value)),
    );

    yield* committed(database, "readwrite", (store) =>
      store.put({ iv, data: new Uint8Array(data) }, name),
    );
  });

  return Keychain.Store.of({
    get: (name) => get(name).pipe(Effect.mapError(unavailable("get"))),
    set: (name, value) => set(name, value).pipe(Effect.mapError(unavailable("set"))),
    remove: (name) =>
      committed(database, "readwrite", (store) => store.delete(name)).pipe(
        Effect.mapError(unavailable("remove")),
      ),
  });
});

/** `Keychain.Store` in this origin's IndexedDB. */
export const layer = Layer.effect(Keychain.Store)(make);
