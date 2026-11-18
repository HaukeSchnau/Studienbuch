import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, layer } from "@effect/vitest";
import { Api } from "@stu/api";
import { Access } from "@stu/api/Access";
import { Accounts } from "@stu/api/Accounts";
import { Dev } from "@stu/api/Dev";
import { Keys } from "@stu/api/Keys";
import { AccountKey, Wrapper } from "@stu/e2ee";
import { TestCrypto } from "@stu/e2ee/testing";
import { Ports } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import * as Arr from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Redacted from "effect/Redacted";
import * as RpcClient from "effect/rpc/RpcClient";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import { Pool } from "pg";
import { Auth } from "../auth/Auth.ts";
import { CardLogins } from "../auth/CardLogins.ts";
import { Deletion } from "./Deletion.ts";
import { DemoAccounts } from "../demo/DemoAccounts.ts";
import { Seed } from "../demo/Seed.ts";
import { Deployment } from "../infra/config/Deployment.ts";
import { Database } from "../infra/database/Database.ts";
import { DatabaseTesting } from "../infra/database/DatabaseTesting.ts";
import { Mail } from "../infra/mail/Mail.ts";
import { Rpc } from "../routes/Rpc.ts";

const publicUrl = "http://localhost:3000";

/** Every mail the server hands to `Mail`, also the ones it sends after answering. */
class Outbox extends Context.Service<Outbox, Queue.Queue<Mail.Message>>()("Test.Outbox") {}

const watchedMail = Layer.effect(Mail.Service)(
  Effect.gen(function* () {
    const mail = yield* Mail.Service;
    const outbox = yield* Outbox;

    return Mail.Service.of({
      send: (message) => Effect.tap(mail.send(message), () => Queue.offer(outbox, message)),
    });
  }),
).pipe(
  Layer.provide(Mail.layer),
  Layer.provideMerge(Layer.effect(Outbox)(Queue.unbounded<Mail.Message>())),
);

/** The auth route and every RPC on a database the demo seed filled, as a development server. */
const server = Layer.unwrap(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ readonly name: string }>`select current_database() as name`;
    const socket = encodeURIComponent(Postgres18.socket ?? "");

    const env = {
      STUDIENBUCH_ENVIRONMENT: "development",
      DATABASE_URL: `postgresql://postgres@localhost/${row?.name}?host=${socket}`,
      PUBLIC_URL: publicUrl,
      AUTH_SECRET: "a test secret that is long enough for Better Auth",
      PASSKEY_RP_ID: "localhost",
      MAIL_URL: "capture:",
      MAIL_FROM: "Studienbuch <studienbuch@localhost>",
      DEMO_KEY_SEED: "a demo key seed that is long enough for the tests",
      DEMO_PASSWORD: "a review password long enough",
    };

    yield* Seed.run.pipe(
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
      Effect.provideService(Deployment.Current, { revision: "test", environment: "development" }),
    );

    return HttpRouter.serve(Layer.mergeAll(Auth.route, Rpc.layer), {
      disableLogger: true,
      disableListenLog: true,
    }).pipe(
      Layer.provideMerge(NodeHttpServer.layerTest),
      Layer.provideMerge(Auth.layer),
      Layer.provideMerge(watchedMail),
      Layer.provideMerge(Database.layer),
      Layer.provideMerge(Deployment.layer),
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
    );
  }),
).pipe(
  Layer.provide([DatabaseTesting.prepared, DemoAccounts.seeding]),
  Layer.provideMerge(NodeServices.layer),
);

/** The `Api.Rpcs` client over HTTP, as a device calls it. */
const rpc = Effect.gen(function* () {
  const server = yield* HttpServer.HttpServer;
  const url = new URL(Api.path, HttpServer.formatAddress(server.address));

  return yield* RpcClient.make(Api.Rpcs).pipe(
    Effect.provide(
      RpcClient.layerProtocolHttp({ url: url.toString() }).pipe(
        Layer.provide([FetchHttpClient.layer, Api.serialization]),
      ),
    ),
  );
});

const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

/** The session token in a signed bearer, as `auth_session` keeps it. */
const rawOf = (signed: string) => decodeURIComponent(signed).split(".")[0] ?? "";

/**
 * How many rows of each table name any of `needles` anywhere, a table per line. A row is read as
 * its whole text, so a column added later is searched too.
 */
const mentions = (needles: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const tables = yield* sql<{ readonly name: string }>`
      select table_name as name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
        and table_name not like 'cluster_%' and table_name <> 'studienbuch_migration'
      order by table_name
    `;

    const counts = yield* Effect.forEach(tables, ({ name }) =>
      Effect.map(
        sql<{ readonly count: number }>`
          select count(*)::int as count from ${sql(name)} t
          where exists (select 1 from unnest(${needles}::text[]) n where strpos(t::text, n) > 0)
        `,
        ([row]) => [name, row?.count ?? 0] as const,
      ),
    );

    return counts.filter(([, count]) => count > 0).map(([name, count]) => `${name} ${count}`);
  });

/** Lena's id, address and notebook, which no row may name after her deletion. */
const lena = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{ readonly email: string; readonly notebook: string }>`
    select u.email, a.notebook_id as notebook
    from auth_user u join school_access a on a.account_id = u.id
    where u.id = 'demo-lena'
  `;

  return ["demo-lena", row?.email ?? "missing", row?.notebook ?? "missing"];
});

/** A Notfallkarte for Lena, sealed to her demo root key. */
const card = (rootKey: Uint8Array) =>
  Effect.gen(function* () {
    const keys = yield* AccountKey.derive(Redacted.make(rootKey), "demo-lena", 0);

    const made = yield* Wrapper.create(
      { id: "lena-card", kind: "code", place: "card", credentialId: "" },
      Redacted.make(new Uint8Array(16).fill(2)),
      keys,
    );

    return new Keys.Sealed(made);
  }).pipe(Effect.provide(TestCrypto.layer("Deletion.test")));

/** Lena on two devices, with a passkey, a Notfallkarte she used once and a reset code waiting. */
const lenaEverywhere = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const client = yield* rpc;
  const phone = yield* client["Demo.signIn"]({ persona: "lena" });
  const laptop = yield* client["Demo.signIn"]({ persona: "lena" });

  yield* client["Keys.addWrapper"]({ wrapper: yield* card(phone.rootKey) }, bearer(phone.token));
  yield* client["Keys.fetchSeals"]({ method: Keys.RecoveryCode.make({}) }, bearer(laptop.token));

  yield* sql`
    insert into auth_passkey
      (id, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", "createdAt")
    values ('lena-passkey', 'key', 'demo-lena', 'lena-credential', 0, 'multiDevice', true, now())
  `;

  yield* (yield* HttpClient.HttpClient).execute(
    HttpClientRequest.post(`${Accounts.path}/email-otp/request-password-reset`, {
      headers: { origin: publicUrl },
    }).pipe(HttpClientRequest.bodyJsonUnsafe({ email: "lena@demo.studienbuch.app" })),
  );

  // The reset starts after the answer; its mail goes once its code is stored.
  yield* Queue.take(yield* Outbox);

  return { phone: phone.token, laptop: laptop.token };
});

/** Ages the session behind `token` past `Keys.freshSignInMinutes`. */
const ageSession = (token: string) =>
  Effect.flatMap(SqlClient.SqlClient, (sql) =>
    Effect.flatMap(Ports.SessionResolver, (resolver) =>
      Effect.flatMap(resolver.resolve(Headers.fromInput(bearer(token).headers)), (session) =>
        Option.match(session, {
          onNone: () => Effect.die("no session"),
          onSome: ({ sessionId }) =>
            sql`
              update auth_session
              set "createdAt" = now() - make_interval(mins => ${Keys.freshSignInMinutes + 1})
              where id = ${sessionId}
            `,
        }),
      ),
    ),
  );

const sessionOf = (token: string) =>
  Effect.flatMap(Ports.SessionResolver, (resolver) =>
    Effect.map(resolver.resolve(Headers.fromInput(bearer(token).headers)), (session) =>
      Option.map(session, ({ sessionId }) => sessionId),
    ),
  );

describe.skipIf(Postgres18.socket === null)("Account deletion on PostgreSQL 18", () => {
  // The live clock: the wait for revocations has a real deadline.
  layer(server, { excludeTestServices: true })((it) => {
    it.effect(
      "leaves no row of the account in any table, ends every device's session and tells only its devices",
      () =>
        Effect.gen(function* () {
          const client = yield* rpc;
          const resolver = yield* Ports.SessionResolver;
          const devices = yield* lenaEverywhere;
          const tom = (yield* client["Demo.signIn"]({ persona: "tom" })).token;
          const needles = yield* lena;
          const before = yield* mentions(needles);
          const toms = yield* mentions(["demo-tom"]);
          const sessions = [yield* sessionOf(devices.phone), yield* sessionOf(devices.laptop)];

          // A sign-in older than ten minutes proves nothing, and nobody signed out deletes anything.
          yield* ageSession(devices.laptop);

          const stale = yield* Effect.flip(
            client["AccountDeletion.delete"](undefined, bearer(devices.laptop)),
          );

          const nobody = yield* Effect.flip(client["AccountDeletion.delete"](undefined));

          const revoked = yield* Effect.forkChild(
            Stream.runCollect(Stream.take(resolver.revoked, 2)),
            { startImmediately: true },
          );

          yield* client["AccountDeletion.delete"](undefined, bearer(devices.phone));

          expect({
            stale: stale._tag,
            nobody: nobody._tag,
            before: before.length > 8,
            after: yield* mentions(needles),
            toms: yield* mentions(["demo-tom"]),
            revoked: Option.map(
              yield* Effect.timeoutOption(Fiber.join(revoked), "10 seconds"),
              (ids) => [...ids].sort(),
            ),
            resolved: [yield* sessionOf(devices.phone), yield* sessionOf(devices.laptop)],
            deleted: {
              phone: yield* client["AccountDeletion.deleted"](undefined, bearer(devices.phone)),
              laptop: yield* client["AccountDeletion.deleted"](undefined, bearer(devices.laptop)),
              tom: yield* client["AccountDeletion.deleted"](undefined, bearer(tom)),
              nobody: yield* client["AccountDeletion.deleted"](undefined),
              // A backup holds the phone's raw token, without the signature only the device has.
              raw: yield* client["AccountDeletion.deleted"](
                undefined,
                bearer(rawOf(devices.phone)),
              ),
              forged: yield* client["AccountDeletion.deleted"](
                undefined,
                bearer(`${rawOf(devices.phone)}.${btoa("not the server's signature")}`),
              ),
            },
          }).toEqual({
            stale: "AccountDeletion.NotFresh",
            nobody: "AccountDeletion.SignedOut",
            before: true,
            after: [],
            toms,
            revoked: Option.some(Arr.getSomes(sessions).sort()),
            resolved: [Option.none(), Option.none()],
            deleted: {
              phone: true,
              laptop: true,
              tom: false,
              nobody: false,
              raw: false,
              forged: false,
            },
          });
        }),
    );

    // A card sign-in holds its login while Better Auth's own pool adds the session, and the
    // account's deletion starts in between. The sign-in finishes, and the deletion ends its session
    // too, with nothing of the account left.
    it.effect(
      "a card sign-in under way and a deletion both finish, and nothing of it remains",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const login = Base64Url.encode(new Uint8Array(32).fill(9));

          const [database] = yield* sql<{
            readonly name: string;
          }>`select current_database() as name`;

          // Better Auth's pool: a session insert of its own, outside the sign-in's transaction.
          const pool = yield* Effect.acquireRelease(
            Effect.sync(
              () =>
                new Pool({
                  connectionString: `postgresql://postgres@localhost/${database?.name}?host=${encodeURIComponent(Postgres18.socket ?? "")}`,
                  statement_timeout: 15_000,
                }),
            ),
            (opened) => Effect.promise(() => opened.end()),
          );

          yield* sql`
          insert into auth_user (id, name, email, "emailVerified")
          values ('carded', '', 'carded@konto.placeholder.invalid', false)
        `;

          yield* sql`
          insert into auth_account (id, "accountId", "providerId", "userId")
          values ('carded-card', ${yield* CardLogins.digest(login)}, ${CardLogins.provider}, 'carded')
        `;

          const held = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();

          const signingIn = yield* Effect.forkChild(
            CardLogins.signingIn(login, (account) =>
              Effect.gen(function* () {
                yield* Deferred.succeed(held, undefined);
                yield* Deferred.await(release);

                yield* Effect.tryPromise(() =>
                  pool.query(
                    `insert into auth_session (id, "expiresAt", token, "userId")
                   values ('carded-session', now() + interval '1 day', 'token-carded', $1)`,
                    [account],
                  ),
                );
              }),
            ),
          );

          yield* Deferred.await(held);
          const deleting = yield* Effect.forkChild(Deletion.run("carded"));

          // The deletion runs to its end, or waits for the login the sign-in holds.
          yield* Effect.raceFirst(
            Effect.asVoid(Fiber.await(deleting)),
            sql<{ readonly waiting: number }>`
            select count(*)::int as waiting from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'
          `.pipe(Effect.repeat({ until: ([row]) => (row?.waiting ?? 0) > 0 }), Effect.asVoid),
          );

          yield* Deferred.succeed(release, undefined);

          const finished = {
            // Each ended within the time, and succeeded: the sign-in made its session.
            signIn: Option.exists(
              yield* Effect.timeoutOption(Fiber.await(signingIn), "10 seconds"),
              (exit) => Exit.isSuccess(exit) && Option.isSome(exit.value),
            ),
            deletion: Option.exists(
              yield* Effect.timeoutOption(Fiber.await(deleting), "10 seconds"),
              Exit.isSuccess,
            ),
          };

          expect({
            finished,
            left: yield* mentions(["carded", "carded@konto.placeholder.invalid", "token-carded"]),
          }).toEqual({ finished: { signIn: true, deletion: true }, left: [] });
        }),
    );

    // A deletion outside the app, as the inactivity job or the operator will run it, closes the
    // account's connections as the app's does.
    it.effect("any caller of run ends the account's sessions for the resolver", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const resolver = yield* Ports.SessionResolver;

        yield* sql`
          insert into auth_user (id, name, email, "emailVerified")
          values ('inactive', '', 'inactive@example.org', true)
        `;

        yield* sql`
          insert into auth_session (id, "expiresAt", token, "userId") values
            ('inactive-phone', now() + interval '1 day', 'token-inactive-phone', 'inactive'),
            ('inactive-laptop', now() + interval '1 day', 'token-inactive-laptop', 'inactive')
        `;

        const revoked = yield* Effect.forkChild(
          Stream.runCollect(Stream.take(resolver.revoked, 2)),
          { startImmediately: true },
        );

        yield* Deletion.run("inactive");

        expect(
          Option.map(yield* Effect.timeoutOption(Fiber.join(revoked), "10 seconds"), (ids) =>
            [...ids].sort(),
          ),
        ).toEqual(Option.some(["inactive-laptop", "inactive-phone"]));
      }),
    );

    it.effect(
      "deletes the codes of its own address only, though `_` matches any letter in LIKE",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;

          yield* sql`
          insert into auth_user (id, name, email, "emailVerified") values
            ('a-under-b', '', 'a_b@example.org', true), ('a-x-b', '', 'axb@example.org', true)
        `;

          yield* sql`
          insert into auth_verification (id, identifier, value, "expiresAt") values
            ('code-a-under-b', 'email-verification-otp-a_b@example.org', 'hash:0', now() + interval '1 hour'),
            ('code-a-x-b', 'email-verification-otp-axb@example.org', 'hash:0', now() + interval '1 hour')
        `;

          yield* Deletion.run("a-under-b");

          const codes = yield* sql<{ readonly id: string }>`
          select id from auth_verification where id like 'code-a-%' order by id
        `;

          expect(codes.map((row) => row.id)).toEqual(["code-a-x-b"]);
        }),
    );

    it.effect(
      "deletes an account without an address, with its card login and passkey, and mails nothing",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const client = yield* rpc;
          const outbox = yield* Outbox;

          const { token: reservation } = yield* client["Access.redeem"]({
            code: Dev.demoSchoolCode,
          });

          const signedUp = yield* (yield* HttpClient.HttpClient).execute(
            HttpClientRequest.post(`${Accounts.path}${Accounts.cardSignUpPath}`, {
              headers: { origin: publicUrl, [Access.reservationHeader]: reservation },
            }).pipe(
              HttpClientRequest.bodyJsonUnsafe({
                login: Base64Url.encode(new Uint8Array(32).fill(7)),
              }),
            ),
          );

          const token = Option.getOrElse(
            Headers.get(signedUp.headers, "set-auth-token"),
            () => "no token",
          );

          const [account] = yield* sql<{
            readonly id: string;
            readonly email: string;
            readonly notebook: string;
          }>`
            select u.id, u.email, a.notebook_id as notebook
            from auth_session s join auth_user u on u.id = s."userId"
            join school_access a on a.account_id = u.id
            where s.token = ${token.split(".")[0] ?? ""}
          `;

          const needles = [account?.id ?? "missing", account?.email ?? "missing"];

          yield* sql`
            insert into auth_passkey
              (id, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", "createdAt")
            values ('card-passkey', 'key', ${needles[0]}, 'card-credential', 0, 'singleDevice', true, now())
          `;

          const before = yield* mentions([...needles, account?.notebook ?? "missing"]);
          yield* client["AccountDeletion.delete"](undefined, bearer(token));

          expect({
            placeholder: Accounts.isPlaceholder(account?.email ?? ""),
            before: before.filter((line) => /^auth_(account|passkey|user) /u.test(line)),
            after: yield* mentions([...needles, account?.notebook ?? "missing"]),
            mailed: yield* Queue.size(outbox),
          }).toEqual({
            placeholder: true,
            before: ["auth_account 1", "auth_passkey 1", "auth_user 1"],
            after: [],
            mailed: 0,
          });
        }),
    );
  });
});
