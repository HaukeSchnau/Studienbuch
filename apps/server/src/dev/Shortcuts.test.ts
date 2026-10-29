import { describe, expect, layer } from "@effect/vitest";
import { Dev } from "@stu/api/Dev";
import type { System } from "@stu/api/System";
import { Ports } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as RpcTest from "effect/rpc/RpcTest";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import { Deployment } from "../infra/config/Deployment.ts";
import { Fixture } from "../school/Fixture.ts";
import { Shortcuts } from "./Shortcuts.ts";

/** Sessions by bearer token, where the token is the account's id. */
const sessions = Layer.succeed(
  Ports.SessionResolver,
  Ports.SessionResolver.of({
    resolve: (headers) =>
      Effect.succeed(
        Option.map(Headers.get(headers, "authorization"), (token) => ({
          accountId: token.replace("Bearer ", ""),
          sessionId: token,
          expiresAt: DateTime.makeUnsafe(0),
        })),
      ),
    revoked: Stream.never,
  }),
);

/** A client of the `Dev` group as a server in `environment` answers it. */
const client = (environment: System.Environment) =>
  RpcTest.makeClient(Dev.Rpcs).pipe(
    Effect.provide(
      Shortcuts.handlers.pipe(
        Layer.provide([
          Layer.succeed(Deployment.Current, { revision: "test", environment }),
          sessions,
        ]),
      ),
    ),
  );

const signedIn = (account: string) => ({ headers: { authorization: `Bearer ${account}` } });

/** The enrollment rows of the account's notebooks, as `<term> <courses>`. */
const enrollments = (account: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly line: string }>`
      select r.data ->> 'termId' || ' ' || (r.data -> 'courseIds')::text as line
      from sync_row r join school_access a on a.notebook_id = r.space_id
      where a.account_id = ${account} and r.tbl = 'Enrollment'
    `,
  ).pipe(Effect.map((rows) => rows.map((row) => row.line)));

describe.skipIf(Postgres18.socket === null)("Dev on PostgreSQL 18", () => {
  layer(Fixture.database)((it) => {
    it.effect.each([
      { environment: "beta", account: "lena", refusal: "Dev.Unavailable" },
      { environment: "production", account: "lena", refusal: "Dev.Unavailable" },
      { environment: "development", account: undefined, refusal: "Dev.SignedOut" },
      { environment: "preview", account: undefined, refusal: "Dev.SignedOut" },
    ] as const)(
      "$environment refuses $account with $refusal",
      ({ environment, account, refusal }) =>
        Effect.gen(function* () {
          const dev = yield* client(environment);
          const options = account === undefined ? {} : signedIn(account);
          const created = yield* Effect.flip(dev["Dev.createSchool"](undefined, options));
          const admitted = yield* Effect.flip(dev["Dev.admit"]({ school: "dev-any" }, options));

          expect([created._tag, admitted._tag]).toEqual([refusal, refusal]);
        }).pipe(Effect.scoped),
    );

    it.effect("a dev school admits the caller once, with every course it offers today", () =>
      Effect.gen(function* () {
        yield* Fixture.account("mia");
        const dev = yield* client("preview");
        const school = yield* dev["Dev.createSchool"](undefined, signedIn("mia"));
        const first = yield* dev["Dev.admit"]({ school: school.id }, signedIn("mia"));
        const again = yield* dev["Dev.admit"]({ school: school.id }, signedIn("mia"));

        expect({ school, again, enrollments: yield* enrollments("mia") }).toEqual({
          // The TestClock starts on January 1, 1970, in the first half of 1969/70.
          school: { id: school.id, termId: "1969-1", courseIds: ["ma-1", "de-1", "en-1"] },
          again: first,
          enrollments: ['1969-1 ["de-1", "en-1", "ma-1"]'],
        });
      }).pipe(Effect.scoped),
    );
  });
});
