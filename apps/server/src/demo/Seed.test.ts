import { describe, expect, it, layer } from "@effect/vitest";
import { AccountKey, CryptoSuite, SealedRow, SpaceKey } from "@stu/e2ee";
import { Postgres18 } from "@stu/sync/testing";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Deployment } from "../infra/config/Deployment.ts";
import { Fixture } from "../school/Fixture.ts";
import { DemoAccounts } from "./DemoAccounts.ts";
import { DemoKeys } from "./DemoKeys.ts";
import { Seed } from "./Seed.ts";

const demoKeySeed = { DEMO_KEY_SEED: "a demo key seed that is long enough for the tests" };

/** Runs the seed as `prepare` does with these variables, such as beta's `DEMO_PASSWORD`. */
const seedWith = (env: Record<string, string>) =>
  Seed.run.pipe(
    Effect.provide(
      ConfigProvider.layer(ConfigProvider.fromEnv({ env: { ...demoKeySeed, ...env } })),
    ),
  );

const reviewPassword = { DEMO_PASSWORD: "a password long enough for review" };

/** Lena's sessions and passkeys, and whether she has a password. */
const lenasWaysIn = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{
    readonly sessions: number;
    readonly passkeys: number;
    readonly password: boolean;
  }>`
    select
      (select count(*)::int from auth_session where "userId" = 'demo-lena') as sessions,
      (select count(*)::int from auth_passkey where "userId" = 'demo-lena') as passkeys,
      exists (select 1 from auth_account where "userId" = 'demo-lena' and password is not null)
        as password
  `;

  return row;
});

/** A session and a passkey of Lena's, as a sign-in and a registration leave them. */
const signInLena = Effect.flatMap(SqlClient.SqlClient, (sql) =>
  Effect.andThen(
    sql`
      insert into auth_session (id, "expiresAt", token, "userId")
      values (gen_random_uuid()::text, now() + interval '1 day', gen_random_uuid()::text, 'demo-lena')
    `,
    sql`
      insert into auth_passkey (id, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp")
      values (gen_random_uuid()::text, 'key', 'demo-lena', gen_random_uuid()::text, 0, 'multiDevice', true)
    `,
  ),
);

/** Every space with its version, every row with its version, and the demo accounts. */
const state = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  return {
    spaces: yield* sql`
      select kind, id, parent_id as parent, key, version::int as version from space order by id
    `,
    rows: yield* sql`
      select space_id as space, tbl, id, version::int as version from sync_row
      order by space_id, tbl, id
    `,
    members: yield* sql`
      select space_id as space, account_id as account, role from space_member
      order by space_id, account_id
    `,
    accounts: yield* sql`
      select u.id, u.email, d.persona from auth_user u join demo_account d on d.account_id = u.id
      order by u.id
    `,
    keys: yield* sql`
      select account_id as account, generation, record::text as record, created_at as at
      from account_key order by account_id, generation
    `,
  };
});

const decodeRecord = Schema.decodeUnknownEffect(Schema.toCodecJson(AccountKey.Record));

/** The public keys of the account's published generation 0. */
const published = (account: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const [row] = yield* sql<{ readonly record: unknown }>`
      select record from account_key where account_id = ${account} and generation = 0
    `;

    const record = yield* decodeRecord(row?.record);

    return { signingKey: record.signingKey, sealingKey: record.sealingKey };
  });

/** The public keys that the account's root key derives on a beta server. */
const derived = (account: string) =>
  Effect.gen(function* () {
    const rootKey = yield* DemoKeys.rootKey(account);
    const keys = yield* AccountKey.derive(rootKey, account, 0);

    return { signingKey: keys.signingKey, sealingKey: keys.sealingKey };
  }).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: demoKeySeed }))));

const decodeBox = Schema.decodeUnknownEffect(Schema.toCodecJson(SpaceKey.KeyBox));

const decodeEnvelope = Schema.decodeUnknownEffect(Schema.toCodecJson(SealedRow.Envelope));

/**
 * The persona's notebook as a device holding its root key opens it: the box's key, then every
 * sealed row, as `<table> <JSON>`.
 */
const opened = (account: string, notebook: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const { keys, record } = yield* DemoKeys.chain(account);

    const [box] = yield* sql<{ readonly data: unknown }>`
      select data from sync_row where space_id = ${notebook} and tbl = '_key'
    `;

    const [epoch] = yield* SpaceKey.openBox(yield* decodeBox(box?.data), notebook, keys, record);

    const sealed = yield* sql<{
      readonly id: string;
      readonly envelope: unknown;
      readonly ct: Uint8Array;
    }>`
      select id, envelope, ct from sync_row
      where space_id = ${notebook} and tbl = '' and ct is not null order by id
    `;

    return yield* Effect.forEach(sealed, (row) =>
      Effect.gen(function* () {
        const envelope = yield* decodeEnvelope(row.envelope);
        const key = epoch?.key ?? Redacted.make(new Uint8Array(32));

        const { table, json } = yield* SealedRow.open(
          { space: notebook, id: row.id },
          envelope,
          row.ct,
          key,
        );

        return `${table} ${json}`;
      }),
    );
  }).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: demoKeySeed }))));

/** What the seed needs from the server it runs in. */
const seeding = Layer.mergeAll(
  Fixture.database,
  DemoAccounts.seeding,
  CryptoSuite.layer,
  Layer.succeed(Deployment.Current, { revision: "test", environment: "beta" }),
);

describe.skipIf(Postgres18.socket === null)("Seed on PostgreSQL 18", () => {
  layer(seeding)((it) => {
    it.effect("a second seed writes nothing, so no space's version or key record moves", () =>
      Effect.gen(function* () {
        yield* seedWith(reviewPassword);
        const first = yield* state;
        yield* seedWith(reviewPassword);

        expect(yield* state).toEqual(first);
      }),
    );

    it.effect(
      "seals each notebook's profile and homework so the persona's own key opens them",
      () =>
        Effect.gen(function* () {
          yield* seedWith({});
          const lena = yield* opened("demo-lena", "demo-lena");
          const tom = yield* opened("demo-tom", "demo-tom");

          expect({
            lena: lena.filter((row) => row.startsWith("NotebookProfile")),
            tom: tom.filter((row) => row.startsWith("NotebookProfile")),
            // The TestClock starts on January 1, 1970.
            lenasMath: lena.filter((row) => row.includes("ma-1")),
            homework: [lena, tom].map(
              (rows) => rows.filter((row) => row.startsWith("Homework")).length,
            ),
          }).toEqual({
            lena: ['NotebookProfile {"displayName":"Lena"}'],
            tom: ['NotebookProfile {"displayName":"Tom"}'],
            lenasMath: [
              'Homework {"courseId":"ma-1","dueOn":"1970-01-02","title":"Aufgaben S. 112, Nr. 3 bis 7"}',
            ],
            homework: [6, 6],
          });
        }),
    );

    it.effect("publishes each persona's generation 0, derived from its own root key", () =>
      Effect.gen(function* () {
        yield* seedWith({});

        expect({
          accounts: (yield* state).keys.map((row) => [row["account"], row["generation"]]),
          lena: yield* published("demo-lena"),
          tom: yield* published("demo-tom"),
        }).toEqual({
          accounts: [
            ["demo-lena", 0],
            ["demo-tom", 0],
          ],
          lena: yield* derived("demo-lena"),
          tom: yield* derived("demo-tom"),
        });
      }),
    );
  });

  layer(seeding)((it) => {
    it.effect("a changed or removed DEMO_PASSWORD ends the personas' sessions and passkeys", () =>
      Effect.gen(function* () {
        yield* seedWith(reviewPassword);
        yield* signInLena;
        yield* seedWith(reviewPassword);
        const unchanged = yield* lenasWaysIn;
        yield* seedWith({ DEMO_PASSWORD: "another password long enough" });
        const changed = yield* lenasWaysIn;
        yield* signInLena;
        yield* seedWith({});

        expect({ unchanged, changed, removed: yield* lenasWaysIn }).toEqual({
          unchanged: { sessions: 1, passkeys: 1, password: true },
          changed: { sessions: 0, passkeys: 0, password: true },
          removed: { sessions: 0, passkeys: 0, password: false },
        });
      }),
    );
  });

  layer(seeding)((it) => {
    it.effect("refuses to seed without DEMO_KEY_SEED, which the personas' keys derive from", () =>
      Effect.gen(function* () {
        const refusal = yield* Effect.flip(
          Seed.run.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} })))),
        );

        expect([refusal._tag, (yield* state).accounts]).toEqual(["ConfigError", []]);
      }),
    );
  });

  it.effect("two seeds on fresh databases give the same ids", () =>
    Effect.gen(function* () {
      // Fresh databases publish the same key records at different times.
      const withoutTimes = Effect.map(state, ({ keys, ...rest }) => ({
        ...rest,
        keys: keys.map((key) => [key["account"], key["generation"], key["record"]]),
      }));

      const seeded = Effect.andThen(seedWith({}), withoutTimes).pipe(Effect.provide(seeding));

      const one = yield* seeded;

      expect({
        accounts: one.accounts,
        enrollments: one.rows.filter((row) => row["tbl"] === "Enrollment"),
      }).toEqual({
        accounts: [
          { id: "demo-lena", email: "lena@demo.studienbuch.app", persona: "lena" },
          { id: "demo-tom", email: "tom@demo.studienbuch.app", persona: "tom" },
        ],
        // The TestClock starts on January 1, 1970, in the first half of 1969/70.
        enrollments: [
          { space: "demo-lena", tbl: "Enrollment", id: "1969-1", version: 2 },
          { space: "demo-tom", tbl: "Enrollment", id: "1969-1", version: 2 },
        ],
      });
      expect(yield* seeded).toEqual(one);
    }),
  );
});
