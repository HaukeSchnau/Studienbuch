import { describe, expect, layer } from "@effect/vitest";
import type { System } from "@stu/api/System";
import { CryptoSuite } from "@stu/e2ee";
import { Postgres18 } from "@stu/sync/testing";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as SqlClient from "effect/sql/SqlClient";
// An HKDF independent of the suite's checks the formula that DemoKeys.ts documents.
// oxlint-disable-next-line effecttsgo/node-builtin-import -- see above
import * as NodeCrypto from "node:crypto";
import { Deployment } from "../infra/config/Deployment.ts";
import { Fixture } from "../school/Fixture.ts";
import { DemoKeys } from "./DemoKeys.ts";

const seed = "a demo key seed that is long enough for the tests";

const keySeed = (value: string) =>
  ConfigProvider.layer(ConfigProvider.fromEnv({ env: { DEMO_KEY_SEED: value } }));

/** The formula in DemoKeys.ts, through Node's own HKDF instead of the suite's. */
const expected = (environment: string, account: string) =>
  new Uint8Array(
    NodeCrypto.hkdfSync(
      "sha256",
      seed,
      new Uint8Array(0),
      Buffer.concat([
        Buffer.from("stu.demo.root.v1"),
        Buffer.from([0]),
        Buffer.from(environment),
        Buffer.from([0]),
        Buffer.from(account),
      ]),
      32,
    ),
  );

/** The account's root key as a server in `environment` derives it. */
const rootKey = (account: string, environment: System.Environment = "beta") =>
  Effect.map(DemoKeys.rootKey(account), Redacted.value).pipe(
    Effect.provideService(Deployment.Current, { revision: "test", environment }),
  );

describe.skipIf(Postgres18.socket === null)("DemoKeys on PostgreSQL 18", () => {
  layer(Layer.mergeAll(Fixture.database, CryptoSuite.layer, keySeed(seed)))((it) => {
    it.effect("derives each demo account's own key per environment, and none for another", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        for (const account of ["demo-lena", "demo-tom", "mia"]) yield* Fixture.account(account);

        yield* sql`
          insert into demo_account (account_id, persona)
          values ('demo-lena', 'lena'), ('demo-tom', 'tom')
        `;

        const lena = yield* rootKey("demo-lena");

        expect({
          // Pinned, so a change to the label or the layout fails here even when made in both files.
          pinned: Hex.encode(lena),
          lena,
          tom: yield* rootKey("demo-tom"),
          production: yield* rootKey("demo-lena", "production"),
          mia: (yield* Effect.flip(rootKey("mia")))._tag,
        }).toEqual({
          pinned: "bb343e278ba6f44e784668a670f31a9b56ebed7eca21b57870a1aea2bdb0bc76",
          lena: expected("beta", "demo-lena"),
          tom: expected("beta", "demo-tom"),
          production: expected("production", "demo-lena"),
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
