import { CryptoSuite } from "@stu/e2ee";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Ids } from "./Ids.ts";

/** A suite whose generator hands out the bytes 0xff, 0xfe, 0xfd and so on. */
const descending = CryptoSuite.Service.of({
  randomBytes: (length) => Effect.succeed(Uint8Array.from({ length }, (_, index) => 0xff - index)),
  sha256: () => Effect.die("unused"),
  hmac: () => Effect.die("unused"),
  hkdf: () => Effect.die("unused"),
  aead: { seal: () => Effect.die("unused"), open: () => Effect.die("unused") },
  sign: {
    publicKey: () => Effect.die("unused"),
    sign: () => Effect.die("unused"),
    verify: () => Effect.die("unused"),
  },
  kem: {
    publicKey: () => Effect.die("unused"),
    encapsulate: () => Effect.die("unused"),
    decapsulate: () => Effect.die("unused"),
  },
});

it.effect("a random id is a UUIDv4 of the suite's bytes", () =>
  Effect.gen(function* () {
    const id = yield* Effect.provideService(Ids.random, CryptoSuite.Service, descending);

    expect(id).toBe("fffefdfc-fbfa-49f8-b7f6-f5f4f3f2f1f0");
  }),
);
