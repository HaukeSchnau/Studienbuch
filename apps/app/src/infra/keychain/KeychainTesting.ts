import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { Keychain } from "./Keychain.ts";
import { MemoryKeychain } from "./MemoryKeychain.ts";

// A keychain for tests that refuses the calls a test names, as a locked iOS keychain or a
// browser's full storage does.

export * as KeychainTesting from "./KeychainTesting.ts";

type Operation = Keychain.Unavailable["operation"];

/** Calls of `operation` on every entry whose name contains `name` fail. */
export interface Refusal {
  readonly operation: Operation;
  readonly name: string;
}

/** A keychain in memory, refusing what `refuse` names until the next `refuse`. */
export const make = Effect.gen(function* () {
  const memory = yield* Effect.provide(Keychain.Store, MemoryKeychain.layer());
  const refusals = yield* Ref.make<ReadonlyArray<Refusal>>([]);

  const unless = <A>(
    operation: Operation,
    name: string,
    call: Effect.Effect<A, Keychain.Unavailable>,
  ) =>
    Effect.flatMap(Ref.get(refusals), (all) =>
      all.some((each) => each.operation === operation && name.includes(each.name))
        ? Effect.fail(new Keychain.Unavailable({ operation, cause: "refused" }))
        : call,
    );

  const keychain = Layer.succeed(Keychain.Store)({
    get: (name) => unless("get", name, memory.get(name)),
    set: (name, value) => unless("set", name, memory.set(name, value)),
    remove: (name) => unless("remove", name, memory.remove(name)),
  });

  return {
    keychain,
    refuse: (...each: ReadonlyArray<Refusal>) => Ref.set(refusals, each),
  };
});
