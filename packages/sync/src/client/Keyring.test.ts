import { assert, it } from "@effect/vitest";
import { AccountKey } from "@stu/e2ee";
import { TestCrypto } from "@stu/e2ee/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { Devices } from "./fixture/Devices.ts";
import { Keyring } from "./Keyring.ts";
import { Ports } from "./Ports.ts";

// A first device keeps its new root key as `pending-key` until the server took it. The engine
// must not seal with it before then, nor after the server refused it for another chain.
it.effect("the keyring opens with the root key only, never with a pending one", () =>
  Effect.gen(function* () {
    const secrets = yield* Ports.DeviceSecrets;
    yield* secrets.set("pending-key", new Uint8Array([...Devices.rootKey, ...Devices.rootKey]));
    const pending = yield* (yield* Keyring.make(Devices.actor)).account;
    yield* secrets.set("root-key", Devices.rootKey);
    const unlocked = yield* (yield* Keyring.make(Devices.actor)).account;

    assert.isTrue(Option.isNone(pending));
    assert.isTrue(Option.exists(unlocked, ({ keys, record }) => AccountKey.matches(keys, record)));
  }).pipe(
    Effect.provide(
      Layer.mergeAll(Devices.secrets, Devices.database("sqlite-node"), TestCrypto.layer("keyring")),
    ),
  ),
);
