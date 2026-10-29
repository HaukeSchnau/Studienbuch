import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, layer } from "@effect/vitest";
import { Accounts } from "@stu/api/Accounts";
import { Api } from "@stu/api";
import { Ports } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as RpcClient from "effect/rpc/RpcClient";
import { hashPassword } from "better-auth/crypto";
import * as SqlClient from "effect/sql/SqlClient";
import { Auth } from "../auth/Auth.ts";
import { Deployment } from "../infra/config/Deployment.ts";
import { Database } from "../infra/database/Database.ts";
import { Testing } from "../infra/database/Testing.ts";
import { Mail } from "../infra/mail/Mail.ts";
import { Rpc } from "../routes/Rpc.ts";
import { DemoAccounts } from "./DemoAccounts.ts";
import { Seed } from "./Seed.ts";

const publicUrl = "http://localhost:3000";

const demoKeySeed = "a demo key seed that is long enough for the tests";

const demoPassword = "a review password long enough";

/** Counts the calls that reach `Auth.Service.signInDemo`. */
const SignInDemoCalls = { count: 0 };

/**
 * The auth route and every RPC at `/api/rpc` on a seeded database, as a server in `environment`
 * serves them, with `signInDemo` counting its calls. `keySeed: false` serves without the
 * `DEMO_KEY_SEED` that the seed had.
 */
const server = (environment: string, options: { readonly keySeed?: boolean } = {}) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const [row] = yield* sql<{ readonly name: string }>`select current_database() as name`;
      const socket = encodeURIComponent(Postgres18.socket ?? "");

      const env = {
        STUDIENBUCH_ENVIRONMENT: environment,
        DATABASE_URL: `postgresql://postgres@localhost/${row?.name}?host=${socket}`,
        PUBLIC_URL: publicUrl,
        AUTH_SECRET: "a test secret that is long enough for Better Auth",
        PASSKEY_RP_ID: "localhost",
        MAIL_URL: environment === "development" ? "capture:" : "smtp://localhost:1",
        MAIL_FROM: "Studienbuch <studienbuch@localhost>",
        DEMO_KEY_SEED: demoKeySeed,
        DEMO_PASSWORD: demoPassword,
      };

      yield* Seed.run.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));
      const { DEMO_KEY_SEED: _, ...withoutKeySeed } = env;
      const served = options.keySeed === false ? withoutKeySeed : env;

      const counted = Layer.effect(Auth.Service)(
        Effect.map(Auth.Service, (auth) => ({
          ...auth,
          signInDemo: (accountId: string) =>
            Effect.andThen(
              Effect.sync(() => SignInDemoCalls.count++),
              auth.signInDemo(accountId),
            ),
        })),
      );

      return HttpRouter.serve(Layer.mergeAll(Auth.route, Rpc.layer), {
        disableLogger: true,
        disableListenLog: true,
      }).pipe(
        Layer.provideMerge(NodeHttpServer.layerTest),
        Layer.provide(counted),
        Layer.provideMerge(Auth.layer),
        Layer.provideMerge(Mail.layer),
        Layer.provideMerge(Database.layer),
        Layer.provideMerge(Deployment.layer),
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: served }))),
      );
    }),
  ).pipe(
    Layer.provide([Testing.prepared, DemoAccounts.seeding]),
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

/** What the sign-up and code routes take. */
interface AuthBody {
  readonly email: string;
  readonly password?: string;
  readonly name?: string;
  readonly otp?: string;
}

/** One call to Better Auth from a client address of its own, as its rate limits count them. */
const auth = Effect.fnUntraced(function* (path: string, body: AuthBody) {
  const client = yield* HttpClient.HttpClient;
  const address = `10.${crypto.getRandomValues(new Uint8Array(3)).join(".")}`;

  const response = yield* client.execute(
    HttpClientRequest.post(`${Accounts.path}${path}`, {
      headers: { "x-forwarded-for": address, origin: publicUrl },
    }).pipe(HttpClientRequest.bodyJsonUnsafe(body)),
  );

  return {
    status: response.status,
    token: Option.getOrUndefined(Headers.get(response.headers, "set-auth-token")),
  };
});

/** Signs Mia up with an address of her own and returns her device's signed token. */
const signUpMia = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const email = "mia@example.org";
  yield* auth("/sign-up/email", { email, password: "lange-genug-123", name: "" });

  const [mail] = yield* sql<{ readonly text: string }>`
    select text from captured_mail where "to" = ${email} order by sent_at desc limit 1
  `;

  const otp = /\b(?<code>\d{6})\b/u.exec(mail?.text ?? "")?.groups?.code ?? "";
  const verified = yield* auth("/email-otp/verify-email", { email, otp });

  return verified.token ?? "no token";
});

const demoAccounts = Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql<{ readonly account: string }>`
    select account_id as account from demo_account order by account_id
  `,
).pipe(Effect.map((rows) => rows.map((row) => row.account)));

/** Signs in with a password, as the store review account does on beta. */
const signIn = (email: string, password: string) =>
  Effect.map(auth("/sign-in/email", { email, password }), (response) => response.token ?? "");

/** Mia, an ordinary account that signs in with a password, as one does before access codes. */
const passwordAccount = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const hash = yield* Effect.promise(() => hashPassword("lange-genug-123"));
  yield* sql`
    insert into auth_user (id, name, email, "emailVerified")
    values ('mia', '', 'mia@example.org', true)
  `;
  yield* sql`
    insert into auth_account (id, "accountId", "providerId", "userId", password)
    values ('mia-credential', 'mia', 'credential', 'mia', ${hash})
  `;

  return yield* signIn("mia@example.org", "lange-genug-123");
});

/**
 * Outside development and preview, nobody signs in as a persona, the review account signs in with
 * its password and gets its root key, and an ordinary account gets none.
 */
const outsideDevelopment = Effect.gen(function* () {
  const client = yield* rpc;
  const service = yield* Auth.Service;
  const persona = yield* Effect.flip(client["Demo.signIn"]({ persona: "lena" }));
  const minted = yield* Effect.flip(service.signInDemo("demo-lena"));
  const review = yield* signIn("lena@demo.studienbuch.app", demoPassword);
  const lenasKey = yield* client["Demo.rootKey"](undefined, bearer(review));
  const mia = yield* passwordAccount;
  const miasKey = yield* Effect.flip(client["Demo.rootKey"](undefined, bearer(mia)));
  const nobody = yield* Effect.flip(client["Demo.rootKey"](undefined));

  expect({
    persona: persona._tag,
    minted: minted._tag,
    lenasKey: lenasKey.rootKey.length,
    miasKey: miasKey._tag,
    nobody: nobody._tag,
  }).toEqual({
    persona: "Demo.Unavailable",
    minted: "Auth.NotDemo",
    lenasKey: 32,
    miasKey: "Demo.NotDemo",
    nobody: "Demo.SignedOut",
  });
});

describe.skipIf(Postgres18.socket === null)("Demo sign-in over the router", () => {
  layer(server("development"))((it) => {
    it.effect(
      "no route but Demo.signIn reaches a demo session, and none makes a demo account",
      () =>
        Effect.gen(function* () {
          const resolver = yield* Ports.SessionResolver;
          const sql = yield* SqlClient.SqlClient;
          const client = yield* rpc;
          const mia = yield* signUpMia;
          // An address the seed gave a persona stays the persona's.
          yield* auth("/sign-up/email", {
            email: "lena@demo.studienbuch.app",
            password: "lange-genug-123",
            name: "",
          });

          const lenas = yield* sql<{ readonly id: string }>`
          select id from auth_user where email = 'lena@demo.studienbuch.app'
        `;

          SignInDemoCalls.count = 0;

          // Every RPC the router serves, called by an account the seed didn't make. A new RPC fails
          // the census below until it joins this list.
          const calls = yield* Effect.all({
            "System.info": Effect.exit(client["System.info"](undefined, bearer(mia))),
            "Mail.captured": Effect.exit(client["Mail.captured"](undefined, bearer(mia))),
            "Dev.createSchool": Effect.exit(client["Dev.createSchool"](undefined, bearer(mia))),
            "Dev.admit": Effect.exit(client["Dev.admit"]({ school: "demo-schule" }, bearer(mia))),
            "Dev.admitToDemoSchool": Effect.exit(
              client["Dev.admitToDemoSchool"](undefined, bearer(mia)),
            ),
            "Demo.signIn": Effect.exit(client["Demo.signIn"]({ persona: "lena" }, bearer(mia))),
            "Demo.rootKey": Effect.exit(client["Demo.rootKey"](undefined, bearer(mia))),
          });

          const lena = calls["Demo.signIn"];
          const token = Exit.isSuccess(lena) ? lena.value.token : "";
          const handedOver = Exit.isSuccess(lena) ? lena.value.rootKey : undefined;
          const lenasKey = yield* client["Demo.rootKey"](undefined, bearer(token));

          // Any answer at the path, here to an empty batch of requests.
          const answer = yield* (yield* HttpClient.HttpClient).execute(
            HttpClientRequest.post(Api.path).pipe(
              HttpClientRequest.bodyText("", "application/ndjson"),
            ),
          );

          const miasKey = yield* Effect.flip(client["Demo.rootKey"](undefined, bearer(mia)));

          const [raw] = yield* sql<{ readonly token: string }>`
          select token from auth_session where "userId" = 'demo-lena'
        `;

          const resolved = yield* resolver.resolve(Headers.fromInput(bearer(token).headers));

          const unsigned = yield* resolver.resolve(
            Headers.fromInput(bearer(raw?.token ?? "").headers),
          );

          const notDemo = yield* Effect.flip(
            Effect.flatMap(Auth.Service, (service) => service.signInDemo("demo-missing")),
          );

          expect({
            census: Object.keys(calls).sort(),
            answered: Object.values(calls).map((exit) => exit._tag),
            miasKey: miasKey._tag,
            lenasKey: lenasKey.rootKey,
            cacheControl: answer.headers["cache-control"],
            signInDemoCalls: SignInDemoCalls.count,
            demoAccounts: yield* demoAccounts,
            lenas: lenas.map((row) => row.id),
            resolved: Option.map(resolved, (session) => session.accountId),
            unsigned: Option.isNone(unsigned),
            notDemo: notDemo._tag,
          }).toEqual({
            census: [...Api.Rpcs.requests.keys()].sort(),
            // Mia is no demo account, so `Demo.rootKey` refuses her.
            answered: ["Success", "Success", "Success", "Success", "Success", "Success", "Failure"],
            miasKey: "Demo.NotDemo",
            lenasKey: handedOver,
            cacheControl: "no-store",
            signInDemoCalls: 1,
            demoAccounts: ["demo-lena", "demo-tom"],
            lenas: ["demo-lena"],
            resolved: Option.some("demo-lena"),
            unsigned: true,
            notDemo: "Auth.NotDemo",
          });
        }),
    );
  });

  layer(server("beta"))((it) => {
    it.effect(
      "beta signs no persona in, and gives a root key to demo accounts only",
      () => outsideDevelopment,
    );
  });

  layer(server("production"))((it) => {
    it.effect(
      "production signs no persona in, and gives a root key to demo accounts only",
      () => outsideDevelopment,
    );
  });

  layer(server("preview", { keySeed: false }))((it) => {
    it.effect(
      "a server without DEMO_KEY_SEED signs no persona in and leaves no session behind",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const client = yield* rpc;
          const signedIn = yield* Effect.exit(client["Demo.signIn"]({ persona: "lena" }));

          const [sessions] = yield* sql<{ readonly count: number }>`
          select count(*)::int as count from auth_session where "userId" = 'demo-lena'
        `;

          expect([signedIn._tag, sessions?.count]).toEqual(["Failure", 0]);
        }),
    );
  });
});
