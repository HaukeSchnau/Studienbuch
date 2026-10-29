import { describe, expect, it, layer } from "@effect/vitest";
import { Postgres18 } from "@stu/sync/testing";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";
import { Fixture } from "../school/Fixture.ts";
import { DemoAccounts } from "./DemoAccounts.ts";
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
  };
});

describe.skipIf(Postgres18.socket === null)("Seed on PostgreSQL 18", () => {
  layer(Layer.merge(Fixture.database, DemoAccounts.seeding))((it) => {
    it.effect("a second seed writes nothing, so no space's version moves", () =>
      Effect.gen(function* () {
        yield* seedWith(reviewPassword);
        const first = yield* state;
        yield* seedWith(reviewPassword);

        expect(yield* state).toEqual(first);
      }),
    );
  });

  layer(Layer.merge(Fixture.database, DemoAccounts.seeding))((it) => {
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

  layer(Layer.merge(Fixture.database, DemoAccounts.seeding))((it) => {
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
      const seeded = Effect.andThen(seedWith({}), state).pipe(
        Effect.provide(Layer.merge(Fixture.database, DemoAccounts.seeding)),
      );

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
