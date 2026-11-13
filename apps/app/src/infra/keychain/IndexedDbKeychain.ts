import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";

import { Keychain } from "./Keychain.ts";

// A browser has no keychain. Each value is sealed with AES-GCM under a non-extractable WebCrypto
// key, named by the entry (encryption.md, decision 7), so it doesn't leak without that key, as in
// a copied profile. A script on the page can still have WebCrypto open it: the content security
// policy on /app (WebBuilds.ts) is what keeps other scripts out.

export * as IndexedDbKeychain from "./IndexedDbKeychain.ts";

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

const open = (name: string) =>
  Effect.callback<IDBDatabase, DOMException | null>((resume) => {
    const request = indexedDB.open(name, 1);

    request.addEventListener("upgradeneeded", () => request.result.createObjectStore(entries));
    request.addEventListener("success", () => resume(Effect.succeed(request.result)));
    request.addEventListener("error", () => resume(Effect.fail(request.error)));
  });

const text = new TextEncoder();
const fromBytes = new TextDecoder();

const isKey = (value: unknown): value is CryptoKey => value instanceof CryptoKey;

// A read of a database that doesn't exist finds nothing, so it doesn't create one: a tab that only
// looked, as on a public computer, leaves nothing that shows Studienbuch was used. A browser that
// can't list databases (Firefox before 126) opens it as before.
const exists = (name: string) =>
  Effect.tryPromise(() => indexedDB.databases()).pipe(
    Effect.map((found) => found.some((database) => database.name === name)),
    Effect.orElseSucceed(() => true),
  );

const make = Effect.fn("IndexedDbKeychain.make")(function* (name: string) {
  const scope = yield* Effect.scope;

  const database = yield* Effect.cached(
    Effect.acquireRelease(open(name), (opened) => Effect.sync(() => opened.close())).pipe(
      Scope.provide(scope),
    ),
  );

  const existing = Effect.flatMap(exists(name), (found) =>
    found ? Effect.asSome(database) : Effect.succeedNone,
  );

  const read = (opened: IDBDatabase, entry: string) =>
    committed(opened, "readonly", (store): IDBRequest<unknown> => store.get(entry));

  const created = Effect.fn("IndexedDbKeychain.createWrappingKey")(function* (opened: IDBDatabase) {
    const key = yield* Effect.promise(() =>
      crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]),
    );

    // Two tabs may start at once. Whichever adds its key first wins, and the other reads that one.
    return yield* committed(opened, "readwrite", (store) => store.add(key, wrappingKeyEntry)).pipe(
      Effect.as(key),
      Effect.catch(() => Effect.filterOrFail(read(opened, wrappingKeyEntry), isKey, () => null)),
    );
  });

  const wrappingKey = yield* Effect.cached(
    Effect.flatMap(database, (opened) =>
      Effect.filterOrElse(read(opened, wrappingKeyEntry), isKey, () => created(opened)),
    ),
  );

  const params = (name: string, iv: Uint8Array<ArrayBuffer>): AesGcmParams => ({
    name: "AES-GCM",
    iv,
    additionalData: text.encode(name),
  });

  const get = Effect.fn("IndexedDbKeychain.get")(function* (name: string) {
    const opened = yield* existing;

    if (Option.isNone(opened)) return Option.none();

    const stored = yield* read(opened.value, name);

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

    yield* committed(yield* database, "readwrite", (store) =>
      store.put({ iv, data: new Uint8Array(data) }, name),
    );
  });

  const remove = Effect.fn("IndexedDbKeychain.remove")(function* (name: string) {
    const opened = yield* existing;

    if (Option.isSome(opened)) {
      yield* committed(opened.value, "readwrite", (store) => store.delete(name));
    }
  });

  return Keychain.Store.of({
    get: (name) => get(name).pipe(Effect.mapError(unavailable("get"))),
    set: (name, value) => set(name, value).pipe(Effect.mapError(unavailable("set"))),
    remove: (name) => remove(name).pipe(Effect.mapError(unavailable("remove"))),
  });
});

/** `Keychain.Store` in the IndexedDB database `name` of this origin. */
export const named = (name: string) => Layer.effect(Keychain.Store)(make(name));

/** `Keychain.Store` in this origin's IndexedDB. */
export const layer = named("studienbuch-keychain");
