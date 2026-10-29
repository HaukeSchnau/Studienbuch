import { describe, expect, layer } from "@effect/vitest";
import { CryptoSuite } from "@stu/e2ee";
import { Postgres18 } from "@stu/sync/testing";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as SqlClient from "effect/sql/SqlClient";
// An HKDF independent of the suite's checks the formula that DemoKeys.ts documents.
// oxlint-disable-next-line effecttsgo/node-builtin-import -- see above
import * as NodeCrypto from "node:crypto";
import { Fixture } from "../school/Fixture.ts";
import { DemoKeys } from "./DemoKeys.ts";

const seed = "a demo key seed that is long enough for the tests";

const keySeed = (value: string) =>
  ConfigProvider.layer(ConfigProvider.fromEnv({ env: { DEMO_KEY_SEED: value } }));

/** The formula in DemoKeys.ts, through Node's own HKDF instead of the suite's. */
const expected = (account: string) =>
  new Uint8Array(
    NodeCrypto.hkdfSync(
      "sha256",
      seed,
      new Uint8Array(0),
      Buffer.concat([Buffer.from("stu.demo.root.v1"), Buffer.from([0]), Buffer.from(account)]),
      32,
    ),
  );

const rootKey = (account: string) => Effect.map(DemoKeys.rootKey(account), Redacted.value);

describe.skipIf(Postgres18.socket === null)("DemoKeys on PostgreSQL 18", () => {
  layer(Layer.mergeAll(Fixture.database, CryptoSuite.layer, keySeed(seed)))((it) => {
    it.effect("derives each demo account's own root key, and none for another account", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        for (const account of ["demo-lena", "demo-tom", "mia"]) yield* Fixture.account(account);

        yield* sql`
          insert into demo_account (account_id, persona) values ('demo-lena', 'lena'), ('demo-tom', 'tom')
        `;

        expect({
          lena: yield* rootKey("demo-lena"),
          tom: yield* rootKey("demo-tom"),
          mia: (yield* Effect.flip(rootKey("mia")))._tag,
        }).toEqual({
          lena: expected("demo-lena"),
          tom: expected("demo-tom"),
          mia: "DemoKeys.NotDemo",
        });
      }),
    );

    it.effect.each([
      { name: "a blank seed", value: " " },
      { name: "a short seed", value: "only 31 characters, one too few" },
    ])("refuses $name without printing it", ({ value }) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(rootKey("demo-lena").pipe(Effect.provide(keySeed(value))));

        expect([error._tag, value.trim() === "" || !String(error).includes(value)]).toEqual([
          "ConfigError",
          true,
        ]);
      }),
    );
  });
});
