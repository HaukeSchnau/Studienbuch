import { describe, expect, layer } from "@effect/vitest";
import { School } from "@stu/core";
import { Postgres18 } from "@stu/sync/testing";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import { AccessCodes } from "./AccessCodes.ts";
import { SchoolTesting } from "./SchoolTesting.ts";
import { Schools } from "./Schools.ts";

const school = School.Id.make("am-see");

const data: Schools.Data = {
  id: school,
  school: { name: "Schule am See", timeZone: "Europe/Berlin" },
  schoolYears: {},
  terms: {},
  subjects: {},
  classes: {},
  courses: {},
  offerings: {},
};

/**
 * Waits until a transaction in this database waits for another's lock. It asks again at once,
 * because nothing else could tell.
 */
const someoneWaits = Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`
    select 1 from pg_stat_activity
    where datname = current_database() and wait_event_type = 'Lock'
  `,
).pipe(Effect.repeat({ until: (rows) => rows.length > 0 }));

/**
 * Runs `first` in a transaction that stays open until `second` waits for its locks, then lets both
 * finish, as two requests at the same moment would.
 */
const atOnce = <A, E, R, B, E2, R2>(
  first: Effect.Effect<A, E, R>,
  second: Effect.Effect<B, E2, R2>,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const done = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();

    const one = yield* Effect.forkChild(
      sql.withTransaction(
        Effect.tap(Effect.exit(first), () =>
          Effect.andThen(Deferred.succeed(done, undefined), Deferred.await(release)),
        ),
      ),
    );

    yield* Deferred.await(done);
    const other = yield* Effect.forkChild(Effect.exit(second));
    yield* someoneWaits;
    yield* Deferred.succeed(release, undefined);

    return [yield* Fiber.join(one), yield* Fiber.join(other)] as const;
  });

const uses = (code: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly uses: number; readonly reserved: number }>`
      select c.uses, (select count(*)::int from access_reservation r where r.code_id = c.id) as reserved
      from access_code c where c.id = ${code}
    `,
  ).pipe(Effect.map(([row]) => row));

/** A sign-up with the reservation, as Better Auth's hooks record it, with its password's hash. */
const signUp = (account: string, token: string, passwordHash = Option.none<string>()) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const known = yield* sql`select 1 from auth_user where id = ${account}`;

    if (known.length === 0) yield* SchoolTesting.account(account);

    // A sign-up's address is unconfirmed until its code comes back.
    yield* sql`update auth_user set "emailVerified" = false where id = ${account}`;
    const claimed = yield* AccessCodes.claimSignUp(token);
    yield* AccessCodes.rememberSignUp(token, `${account}@example.test`, passwordHash);

    return claimed;
  });

describe.skipIf(Postgres18.socket === null)("AccessCodes on PostgreSQL 18", () => {
  layer(SchoolTesting.database)((it) => {
    it.effect("two students confirming a single-use code at once spend it once", () =>
      Effect.gen(function* () {
        yield* Schools.publish(data);

        const minted = yield* AccessCodes.mint({
          school,
          kind: "student",
          maxUses: Option.some(1),
        });

        const ben = yield* AccessCodes.reserve(minted.code);
        const eva = yield* AccessCodes.reserve(minted.code);

        // Signing up holds nothing, so both may.
        const signedUp = [yield* signUp("ben", ben.token), yield* signUp("eva", eva.token)];

        const [one, other] = yield* atOnce(
          AccessCodes.admitConfirmed("ben", Option.some(ben.token)),
          AccessCodes.admitConfirmed("eva", Option.some(eva.token)),
        );

        expect({
          signedUp,
          one: one._tag === "Success" && Option.isSome(one.value),
          other: other._tag === "Success" && Option.isNone(other.value),
          eva: yield* SchoolTesting.memberships("eva"),
          stored: yield* uses(minted.id),
          // Spent, so the code is gone for anyone else.
          again: (yield* Effect.exit(AccessCodes.reserve(minted.code)))._tag,
        }).toEqual({
          signedUp: [true, true],
          one: true,
          other: true,
          eva: [],
          stored: { uses: 1, reserved: 2 },
          again: "Failure",
        });
      }),
    );

    it.effect(
      "admits through the confirming device's reservation, if this address carried it",
      () =>
        Effect.gen(function* () {
          yield* Schools.publish(data);
          const code = yield* AccessCodes.mint({ school, kind: "student", maxUses: Option.none() });
          const mine = yield* AccessCodes.reserve(code.code);
          const someone = yield* AccessCodes.reserve(code.code);
          yield* signUp("mia", mine.token);

          const elsewhere = yield* AccessCodes.admitConfirmed("mia", Option.some(someone.token));
          yield* signUp("mia", mine.token);
          const none = yield* AccessCodes.admitConfirmed("mia", Option.none());
          yield* signUp("mia", mine.token);
          const own = yield* AccessCodes.admitConfirmed("mia", Option.some(mine.token));

          expect([elsewhere, none, Option.isSome(own)]).toEqual([
            Option.none(),
            Option.none(),
            true,
          ]);
        }),
    );

    it.effect("two accounts of one reservation confirming at once spend its code once", () =>
      Effect.gen(function* () {
        yield* Schools.publish(data);

        const minted = yield* AccessCodes.mint({
          school,
          kind: "student",
          maxUses: Option.some(1),
        });

        const { token } = yield* AccessCodes.reserve(minted.code);
        // A mistyped address, then the right one: two accounts from one reservation.
        yield* signUp("lena", token);
        yield* signUp("lena-2", token);

        const [one, other] = yield* atOnce(
          AccessCodes.admitConfirmed("lena", Option.some(token)),
          AccessCodes.admitConfirmed("lena-2", Option.some(token)),
        );

        expect({
          one: one._tag === "Success" && Option.isSome(one.value),
          other: other._tag === "Success" && Option.isNone(other.value),
          lena: (yield* SchoolTesting.memberships("lena")).filter((line) =>
            line.startsWith("school"),
          ),
          lena2: yield* SchoolTesting.memberships("lena-2"),
          stored: yield* uses(minted.id),
        }).toEqual({
          one: true,
          other: true,
          lena: ["school am-see reader"],
          lena2: [],
          stored: { uses: 1, reserved: 1 },
        });
      }),
    );

    // A hash of the student's password, often tied to a mistyped or a stranger's address, must not
    // stay in the database once nothing can confirm with it.
    it.effect(
      "forgets the passwords a reservation's sign-ups chose once it is spent or lapsed",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;

          yield* Schools.publish(data);

          const code = yield* AccessCodes.mint({ school, kind: "student", maxUses: Option.none() });
          const spent = yield* AccessCodes.reserve(code.code);

          // A mistyped address, then the right one, which confirms and spends the reservation.
          yield* signUp("ida-typo", spent.token, Option.some("hash-ida-typo"));
          yield* signUp("ida", spent.token, Option.some("hash-ida"));
          yield* AccessCodes.admitConfirmed("ida", Option.some(spent.token));

          const lapsing = yield* AccessCodes.reserve(code.code);

          yield* signUp("ole", lapsing.token, Option.some("hash-ole"));
          yield* TestClock.adjust("2 hours");

          // The next redemption comes after the first has lapsed; its own sign-up keeps its hash.
          const live = yield* AccessCodes.reserve(code.code);

          yield* signUp("eva", live.token, Option.some("hash-eva"));
          yield* AccessCodes.reserve(code.code);

          const kept = yield* sql<{ readonly account: string; readonly hash: string | null }>`
          select account_id as account, password_hash as hash from access_sign_up
          where account_id in ('ida-typo', 'ole', 'eva') order by account_id
        `;

          expect(kept).toEqual([
            { account: "eva", hash: "hash-eva" },
            { account: "ida-typo", hash: null },
            { account: "ole", hash: null },
          ]);
        }),
    );

    it.effect("a reservation creates a few accounts at most, and a spent one no more", () =>
      Effect.gen(function* () {
        yield* Schools.publish(data);

        const minted = yield* AccessCodes.mint({ school, kind: "student", maxUses: Option.none() });
        const { token } = yield* AccessCodes.reserve(minted.code);
        const claims = [];

        for (const account of ["mia", "mia-2", "mia-3", "mia-4"]) {
          claims.push(yield* signUp(account, token));
        }

        yield* AccessCodes.admitConfirmed("mia", Option.some(token));

        expect({
          claims,
          afterSpent: yield* AccessCodes.claimSignUp(token),
          unknown: yield* AccessCodes.claimSignUp("not a reservation of this server at all"),
        }).toEqual({
          claims: [true, true, true, false],
          afterSpent: false,
          unknown: false,
        });
      }),
    );

    it.effect("refuses a code that is revoked, expired, used up or mistyped", () =>
      Effect.gen(function* () {
        yield* Schools.publish(data);
        const once = yield* AccessCodes.mint({ school, kind: "student", maxUses: Option.some(1) });
        const { token } = yield* AccessCodes.reserve(once.code);
        yield* signUp("tom", token);
        yield* AccessCodes.admitConfirmed("tom", Option.some(token));

        const revoked = yield* AccessCodes.mint({
          school,
          kind: "student",
          maxUses: Option.none(),
        });

        yield* AccessCodes.revoke(revoked.id);

        const expired = yield* AccessCodes.mint({
          school,
          kind: "student",
          maxUses: Option.none(),
          // The TestClock starts at 0, so this is past.
          expiresAt: Option.some(DateTime.toDateUtc(DateTime.makeUnsafe(-1))),
        });

        const outcome = (code: string) =>
          Effect.map(Effect.exit(AccessCodes.reserve(code)), (exit) =>
            exit._tag === "Success" ? "reserved" : "refused",
          );

        expect({
          usedUp: yield* outcome(once.code),
          revoked: yield* outcome(revoked.code),
          expired: yield* outcome(expired.code),
          mistyped: yield* outcome(`${revoked.code.slice(0, -1)}0`),
          // Lower case and no hyphens still name the code.
          retyped: yield* Effect.flatMap(
            AccessCodes.mint({ school, kind: "student", maxUses: Option.none() }),
            (fresh) => outcome(fresh.code.replaceAll("-", "").toLowerCase()),
          ),
        }).toEqual({
          usedUp: "refused",
          revoked: "refused",
          expired: "refused",
          mistyped: "refused",
          retyped: "reserved",
        });
      }),
    );
  });
});
