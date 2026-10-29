/**
 * The demo accounts' root keys (D55, ADR 0027). The server derives R from `DEMO_KEY_SEED` for the
 * accounts in `demo_account` and no other, so previews and the store's reviewers open encrypted
 * demo notebooks while no real account's key ever exists on the server.
 *
 * ```text
 * R = HKDF-SHA256(ikm = UTF-8 of DEMO_KEY_SEED, salt = empty, 32,
 *                 info = "stu.demo.root.v1" || 0x00 || UTF-8 of STUDIENBUCH_ENVIRONMENT
 *                        || 0x00 || UTF-8 of the account id)
 * ```
 */
import { AccountKey, CryptoSuite } from "@stu/e2ee";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { Deployment } from "../infra/config/Deployment.ts";
import { DemoAccounts } from "./DemoAccounts.ts";

export * as DemoKeys from "./DemoKeys.ts";

/** At least 32 characters without blanks around them, so a blank secret file can't pass. */
const Seed = Schema.String.check(Schema.isTrimmed(), Schema.isMinLength(32));

/** `DEMO_KEY_SEED`, which every environment with demo accounts sets and keeps. */
export const seed = Config.schema(Schema.Redacted(Seed), "DEMO_KEY_SEED");

/** The account isn't a demo account, so the server holds no key for it. */
export class NotDemo extends Schema.TaggedError<NotDemo, { readonly brand: unique symbol }>()(
  "DemoKeys.NotDemo",
  { account: Schema.String },
) {}

const encoder = new TextEncoder();

const label = encoder.encode("stu.demo.root.v1");

/** The demo account's root key, generation 0. */
export const rootKey = Effect.fn("DemoKeys.rootKey")(function* (account: string) {
  if (!(yield* Effect.orDie(DemoAccounts.isDemo(account)))) {
    return yield* new NotDemo({ account });
  }

  const suite = yield* CryptoSuite.Service;
  const { environment } = yield* Deployment.Current;
  const place = encoder.encode(environment);
  const id = encoder.encode(account);
  // Zeros separate the parts, and the label and the environment hold none.
  const info = new Uint8Array(label.length + 1 + place.length + 1 + id.length);
  info.set(label);
  info.set(place, label.length + 1);
  info.set(id, label.length + 1 + place.length + 1);

  const key = yield* suite.hkdf({
    ikm: encoder.encode(Redacted.value(yield* seed)),
    salt: new Uint8Array(0),
    info,
    length: 32,
  });

  return Redacted.make(key);
});

/** Generation 0 of the demo account's key chain, signed, as a first device publishes it. */
export const firstRecord = Effect.fn("DemoKeys.firstRecord")(function* (account: string) {
  const keys = yield* AccountKey.derive(yield* rootKey(account), account, 0);

  return yield* AccountKey.record(keys, "first");
});
