import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, layer } from "@effect/vitest";
import { Accounts } from "@stu/api/Accounts";
import { Api } from "@stu/api";
import { Ports, SyncEpoch } from "@stu/sync/server";
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
import * as SqlClient from "effect/sql/SqlClient";
import * as NodeURL from "node:url";
import { Auth } from "../auth/Auth.ts";
import { Deployment } from "../infra/config/Deployment.ts";
import { Database } from "../infra/database/Database.ts";
import { Migrations } from "../infra/database/Migrations.ts";
import { Mail } from "../infra/mail/Mail.ts";
import { Rpc } from "../routes/Rpc.ts";
import { Seed } from "./Seed.ts";

const publicUrl = "http://localhost:3000";
const migrations = NodeURL.fileURLToPath(new URL("../../migrations/", import.meta.url));

/** Counts the calls that reach `Auth.Service.signInDemo`. */
const SignInDemoCalls = { count: 0 };

/**
 * The auth route and every RPC at `/api/rpc` on a seeded database, as a server in `environment`
 * serves them, with `signInDemo` counting its calls.
 */
const server = (environment: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const [row] = yield* sql<{ readonly name: string }>`select current_database() as name`;
      yield* Migrations.apply(yield* Migrations.read(migrations));
      yield* SyncEpoch.initialize;
      yield* Seed.run;
      const socket = encodeURIComponent(Postgres18.socket ?? "");

      const env = {
        STUDIENBUCH_ENVIRONMENT: environment,
        DATABASE_URL: `postgresql://postgres@localhost/${row?.name}?host=${socket}`,
        PUBLIC_URL: publicUrl,
        AUTH_SECRET: "a test secret that is long enough for Better Auth",
        PASSKEY_RP_ID: "localhost",
        MAIL_URL: environment === "development" ? "capture:" : "smtp://localhost:1",
        MAIL_FROM: "Studienbuch <studienbuch@localhost>",
      };

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
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
      );
    }),
  ).pipe(
    Layer.provideMerge(NodeServices.layer),
    Layer.provide(Postgres18.database(Postgres18.socket ?? "")),
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
          });

          const lena = calls["Demo.signIn"];
          const token = Exit.isSuccess(lena) ? lena.value.token : "";

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
            signInDemoCalls: SignInDemoCalls.count,
            demoAccounts: yield* demoAccounts,
            lenas: lenas.map((row) => row.id),
            resolved: Option.map(resolved, (session) => session.accountId),
            unsigned: Option.isNone(unsigned),
            notDemo: notDemo._tag,
          }).toEqual({
            census: [...Api.Rpcs.requests.keys()].sort(),
            answered: ["Success", "Success", "Success", "Success", "Success", "Success"],
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
    it.effect("beta refuses persona sign-in, even for a seeded persona", () =>
      Effect.gen(function* () {
        const client = yield* rpc;
        const refused = yield* Effect.flip(client["Demo.signIn"]({ persona: "lena" }));
        const auth = yield* Auth.Service;

        expect([refused._tag, (yield* Effect.flip(auth.signInDemo("demo-lena")))._tag]).toEqual([
          "Demo.Unavailable",
          "Auth.NotDemo",
        ]);
      }),
    );
  });
});
