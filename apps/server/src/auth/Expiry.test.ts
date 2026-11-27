import { assert, describe, layer } from "@effect/vitest";
import { Postgres18 } from "@stu/sync/testing";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import { SchoolTesting } from "../school/SchoolTesting.ts";
import { Expiry } from "./Expiry.ts";

const now = DateTime.makeUnsafe("2026-11-27T12:00:00Z");

const at = (offsetSeconds: number) =>
  DateTime.toDateUtc(DateTime.add(now, { seconds: offsetSeconds }));

describe.skipIf(Postgres18.socket === null)("Expiry on PostgreSQL 18", () => {
  layer(SchoolTesting.database)((it) => {
    it.effect("deletes what expired before now, and keeps a row expiring this very moment", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* SchoolTesting.account("ida");

        const session = (id: string, expires: Date) => sql`
          insert into auth_session (id, "expiresAt", token, "userId")
          values (${id}, ${expires}, ${id}, 'ida')
        `;

        const value = (id: string, identifier: string, expires: Date) => sql`
          insert into auth_verification (id, identifier, value, "expiresAt")
          values (${id}, ${identifier}, 'hash:0', ${expires})
        `;

        yield* session("lapsed", at(-1));
        yield* session("unused-for-a-year", at(-365 * 24 * 60 * 60));
        yield* session("this-moment", at(0));
        yield* session("live", at(90 * 24 * 60 * 60));
        yield* value("old-code", "email-verification-otp-ida@example.test", at(-1));
        yield* value("old-challenge", "passkey-challenge", at(-60));
        yield* value("code-this-moment", "forget-password-otp-ida@example.test", at(0));
        yield* value("code", "email-verification-otp-ida@example.test", at(15 * 60));

        yield* Expiry.sweep(now);

        const sessions = yield* sql<{ readonly id: string }>`
          select id from auth_session order by id
        `;

        const values = yield* sql<{ readonly id: string }>`
          select id from auth_verification order by id
        `;

        assert.deepStrictEqual(
          sessions.map((row) => row.id),
          ["live", "this-moment"],
        );
        assert.deepStrictEqual(
          values.map((row) => row.id),
          ["code", "code-this-moment"],
        );
      }),
    );
  });
});
