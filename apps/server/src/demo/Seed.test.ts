import { describe, expect, it, layer } from "@effect/vitest";
import { Postgres18 } from "@stu/sync/testing";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import { Fixture } from "../school/Fixture.ts";
import { Seed } from "./Seed.ts";

/** Beta's review account signs in with this password. */
const withPassword = Effect.provide(
  ConfigProvider.layer(
    ConfigProvider.fromEnv({ env: { DEMO_PASSWORD: "a password long enough for review" } }),
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
  layer(Fixture.database)((it) => {
    it.effect("a second seed writes nothing, so no space's version moves", () =>
      Effect.gen(function* () {
        yield* withPassword(Seed.run);
        const first = yield* state;
        yield* withPassword(Seed.run);

        expect(yield* state).toEqual(first);
      }),
    );
  });

  it.effect("two seeds on fresh databases give the same ids", () =>
    Effect.gen(function* () {
      const seeded = Effect.andThen(Seed.run, state).pipe(Effect.provide(Fixture.database));
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
