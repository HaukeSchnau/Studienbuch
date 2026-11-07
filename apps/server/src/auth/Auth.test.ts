import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, layer } from "@effect/vitest";
import { Access } from "@stu/api/Access";
import { Accounts } from "@stu/api/Accounts";
import { School } from "@stu/core";
import { Ports } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import { desc, eq } from "drizzle-orm";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Fiber from "effect/Fiber";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import * as NodeURL from "node:url";
import { Deployment } from "../infra/config/Deployment.ts";
import { Database } from "../infra/database/Database.ts";
import { Migrations } from "../infra/database/Migrations.ts";
import { Mail } from "../infra/mail/Mail.ts";
import { MailTables } from "../infra/mail/MailTables.ts";
import { Limits } from "../limits/Limits.ts";
import { AccessCodes } from "../school/AccessCodes.ts";
import { Auth } from "./Auth.ts";
import { AuthTables } from "./AuthTables.ts";

const publicUrl = "http://localhost:3000";

/** Every mail the server hands to `Mail`, also the ones it sends in the background. */
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

const school = School.Id.make("auth-school");

const schoolCode = "A7H5-0000-0000-0001";

/** Another school, whose code an attacker might sign the victim's address up with. */
const otherSchool = School.Id.make("other-school");

const otherCode = "A7H5-0000-0000-0002";
const migrations = NodeURL.fileURLToPath(new URL("../../migrations/", import.meta.url));

/**
 * The auth route on a fresh database with every migration, in one environment. Beta sends mail
 * over SMTP, which its tests never reach.
 */
const server = (environment: string, overrides: Record<string, string> = {}) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const [row] = yield* sql<{ readonly name: string }>`select current_database() as name`;

      yield* Migrations.apply(yield* Migrations.read(migrations));
      // A school whose code every test's sign-up redeems.
      yield* sql`insert into space (id, kind) values (${school}, 'school'), (${otherSchool}, 'school')`;

      yield* AccessCodes.ensure({ school, kind: "student", maxUses: Option.none() }, schoolCode);

      yield* AccessCodes.ensure(
        { school: otherSchool, kind: "student", maxUses: Option.none() },
        otherCode,
      );

      const socket = encodeURIComponent(Postgres18.socket ?? "");

      const env = {
        STUDIENBUCH_ENVIRONMENT: environment,
        DATABASE_URL: `postgresql://postgres@localhost/${row?.name}?host=${socket}`,
        PUBLIC_URL: publicUrl,
        AUTH_SECRET: "a test secret that is long enough for Better Auth",
        PASSKEY_RP_ID: "localhost",
        MAIL_URL: environment === "development" ? "capture:" : "smtp://localhost:1",
        MAIL_FROM: "Studienbuch <studienbuch@localhost>",
        ...overrides,
      };

      return HttpRouter.serve(Auth.route, { disableLogger: true, disableListenLog: true }).pipe(
        Layer.provideMerge(NodeHttpServer.layerTest),
        Layer.provideMerge(Auth.layer),
        Layer.provideMerge(watchedMail),
        Layer.provideMerge(Database.layer),
        Layer.provideMerge(Deployment.layer),
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
      );
    }),
  ).pipe(Layer.provide(Postgres18.database(Postgres18.socket ?? "")));

interface CallOptions {
  readonly body?: object;
  /** The access code reservation a sign-up carries. */
  readonly reservation?: string;
  readonly token?: string;
  readonly challenge?: string;
  /** A browser's own origin by default. Native apps send none (`null`). */
  readonly origin?: string | null;
  /** The client's address. A new one for each call by default. */
  readonly from?: string;
}

/**
 * One call to Better Auth, as a device makes it: JSON, a bearer token and no cookie jar. Rate
 * limits count per client address, Better Auth's across every instance in the process, so each
 * call comes from an address of its own unless it names one.
 */
const call = Effect.fnUntraced(function* (
  method: "GET" | "POST",
  path: string,
  options: CallOptions = {},
) {
  const client = yield* HttpClient.HttpClient;
  const address = options.from ?? `10.${crypto.getRandomValues(new Uint8Array(3)).join(".")}`;

  let request = HttpClientRequest.make(method)(`${Accounts.path}${path}`, {
    headers: { "x-forwarded-for": address },
  });

  if (options.token !== undefined) {
    request = HttpClientRequest.bearerToken(request, options.token);
  }

  if (options.reservation !== undefined) {
    request = HttpClientRequest.setHeader(request, Access.reservationHeader, options.reservation);
  }

  if (options.challenge !== undefined) {
    request = HttpClientRequest.setHeader(request, Accounts.challengeHeader, options.challenge);
  }

  // Node's fetch sends Fetch Metadata like a browser, so it needs the Origin a browser sends too.
  if (options.origin !== null) {
    request = HttpClientRequest.setHeader(request, "origin", options.origin ?? publicUrl);
  }

  if (options.body !== undefined) {
    request = HttpClientRequest.bodyJsonUnsafe(request, options.body);
  }

  const response = yield* client.execute(request);
  const text = yield* response.text;

  return {
    status: response.status,
    /** The body as sent, byte for byte. */
    text,
    json: Option.getOrNull(decodeJson(text)),
    cookies: response.headers["set-cookie"] ?? null,
    challenge: Option.getOrUndefined(Headers.get(response.headers, Accounts.challengeHeader)),
    token: Option.getOrUndefined(Headers.get(response.headers, "set-auth-token")),
  };
});

const decodeJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));
const decodeToken = Schema.decodeUnknownEffect(Schema.Struct({ token: Schema.String }));
const decodeCode = Schema.decodeUnknownEffect(Schema.Struct({ code: Schema.String }));
const decodeChallenge = Schema.decodeUnknownEffect(Schema.Struct({ challenge: Schema.String }));

const decodeRegistrationOptions = Schema.decodeUnknownEffect(
  Schema.Struct({
    challenge: Schema.String,
    authenticatorSelection: Schema.Struct({
      residentKey: Schema.String,
      userVerification: Schema.String,
    }),
  }),
);

const decodeAuthenticationOptions = Schema.decodeUnknownEffect(
  Schema.Struct({ challenge: Schema.String, userVerification: Schema.String }),
);

const bearer = (token: string) => Headers.fromInput({ authorization: `Bearer ${token}` });

const password = "lange-genug-123";

const mailCount = (email: string) =>
  Effect.flatMap(Database.Drizzle, (db) =>
    db.$count(MailTables.capturedMail, eq(MailTables.capturedMail.to, email)),
  );

const userOf = (email: string) =>
  Effect.map(
    Effect.flatMap(Database.Drizzle, (db) =>
      db.select().from(AuthTables.user).where(eq(AuthTables.user.email, email)),
    ),
    ([user]) => user,
  );

/** The six digits of the newest captured mail, which went to `email`. */
const codeFor = Effect.fnUntraced(function* (email: string) {
  const db = yield* Database.Drizzle;

  const [mail] = yield* db
    .select()
    .from(MailTables.capturedMail)
    .where(eq(MailTables.capturedMail.to, email))
    .orderBy(desc(MailTables.capturedMail.sentAt));

  return /\b(?<code>\d{6})\b/u.exec(mail?.text ?? "")?.groups?.code ?? "no code";
});

/** The next mail to `email` that `matches`, which the server may send in the background. */
const mailTo = (email: string, matches: (message: Mail.Message) => boolean) =>
  Effect.flatMap(Outbox, (outbox) =>
    Queue.take(outbox).pipe(
      Effect.repeat({ until: (message) => message.to === email && matches(message) }),
    ),
  );

/** The next reset mail to `email`, which the server sends in the background. */
const resetMailTo = (email: string) =>
  mailTo(email, (message) => message.subject.includes("Passwort"));

/** The six digits of the next reset mail to `email`. */
const resetCodeFor = (email: string) =>
  Effect.map(
    resetMailTo(email),
    (mail) => /\b(?<code>\d{6})\b/u.exec(mail.text)?.groups?.code ?? "no code",
  );

/** Whatever the code, a different one of six digits. */
const wrongCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

/** Each answer's status and raw body, which must not tell a known address from another. */
const outcomes = (answers: ReadonlyArray<{ readonly status: number; readonly text: string }>) =>
  Effect.succeed(answers.map((answer) => `${answer.status} ${answer.text}`));

/** Registers a passkey for the account of a fresh session, as "Passkey anlegen" does. */
const addPasskey = Effect.fnUntraced(function* (token: string) {
  const authenticator = yield* VirtualAuthenticator.make;
  const offered = yield* call("GET", "/passkey/generate-register-options", { token });

  const registered = yield* call("POST", "/passkey/verify-registration", {
    token,
    challenge: offered.challenge,
    body: {
      response: authenticator.create(yield* decodeChallenge(offered.json), { verified: true }),
    },
  });

  assert.strictEqual(registered.status, 200);
});

/** A reservation of the test school's code, as `Access.redeem` gives one. */
const reservation = Effect.map(AccessCodes.reserve(schoolCode), ({ token }) => token);

/**
 * Redeems the school's code, signs up, enters the mailed code, and returns the signed token the
 * device keeps.
 */
const signUp = Effect.fnUntraced(function* (email: string) {
  const held = yield* reservation;

  const created = yield* call("POST", "/sign-up/email", {
    body: { email, password, name: "Lena Beispiel" },
    reservation: held,
  });

  assert.strictEqual(created.status, 200);

  // The confirmation carries the password, which counts from here on, and the device's reservation.
  const verified = yield* call("POST", "/email-otp/verify-email", {
    body: { email, otp: yield* codeFor(email), password },
    reservation: held,
  });

  assert.strictEqual(verified.status, 200);
  assert.strictEqual(verified.cookies, null);

  const resolver = yield* Ports.SessionResolver;
  const raw = (yield* decodeToken(verified.json)).token;

  // The raw token in the body, as in a dump of the session table, opens nothing.
  assert.isTrue(Option.isNone(yield* resolver.resolve(bearer(raw))));

  return verified.token ?? "no signed token";
});

/** Revocations from now on, `count` of them. */
const revocations = (count: number) =>
  Effect.flatMap(Ports.SessionResolver, (resolver) =>
    Effect.forkChild(Stream.runCollect(Stream.take(resolver.revoked, count)), {
      startImmediately: true,
    }),
  );

describe.skipIf((Postgres18.socket ?? null) === null)("Auth", () => {
  layer(NodeServices.layer)((it) => {
    // One server for the file: each test signs up its own address.
    it.layer(server("development"))((it) => {
      it.effect(
        "a sign-up with a school's code is admitted there when its mailed code signs in",
        () =>
          Effect.gen(function* () {
            const resolver = yield* Ports.SessionResolver;

            const short = yield* call("POST", "/sign-up/email", {
              body: { email: "lena.signup@example.org", password: "123456789", name: "" },
              reservation: yield* reservation,
            });

            assert.strictEqual(short.status, 400);
            assert.deepStrictEqual(yield* decodeCode(short.json), { code: "PASSWORD_TOO_SHORT" });

            const token = yield* signUp("lena.signup@example.org");

            assert.isTrue(Option.isSome(yield* resolver.resolve(bearer(token))));
            assert.isTrue(Option.isNone(yield* resolver.resolve(Headers.empty)));

            // The name lives in the encrypted notebook, whatever sign-up sent.
            const user = yield* userOf("lena.signup@example.org");

            assert.deepStrictEqual([user?.name, user?.image], ["", null]);

            // Confirming the address admitted the account before its session existed.
            const sql = yield* SqlClient.SqlClient;

            const admitted = yield* sql<{ readonly school: string }>`
            select school_id as school from school_access where account_id = ${user?.id ?? ""}
          `;

            assert.deepStrictEqual(admitted, [{ school }]);

            // The console lists the code's mail for whoever tests the sign-up.
            const mails = yield* Mail.captured;

            assert.strictEqual(mails[0]?.to, "lena.signup@example.org");
          }),
      );

      it.effect("a password from before the address was confirmed never signs anyone in", () =>
        Effect.gen(function* () {
          const email = "opfer@example.org";
          const theirs = "vom-mitschueler-gewaehlt";
          const mine = "mein-eigenes-passwort";

          // A classmate with the class code signs up the victim's address first.
          yield* call("POST", "/sign-up/email", {
            body: { email, password: theirs, name: "" },
            reservation: yield* reservation,
          });

          // Later the victim signs up, asks for the code again and enters it.
          const signedUp = yield* call("POST", "/sign-up/email", {
            body: { email, password: mine, name: "" },
            reservation: yield* reservation,
          });

          // A later mail, so `codeFor` reads its code.
          yield* TestClock.adjust("1 minute");
          yield* call("POST", "/send-verification-email", { body: { email } });

          const confirmed = yield* call("POST", "/email-otp/verify-email", {
            body: { email, otp: yield* codeFor(email), password: mine },
          });

          const asClassmate = yield* call("POST", "/sign-in/email", {
            body: { email, password: theirs },
          });

          const asVictim = yield* call("POST", "/sign-in/email", {
            body: { email, password: mine },
          });

          assert.deepStrictEqual(
            {
              signedUp: signedUp.status,
              confirmed: confirmed.status,
              asClassmate: asClassmate.status,
              asVictim: asVictim.status,
            },
            { signedUp: 200, confirmed: 200, asClassmate: 401, asVictim: 200 },
          );
        }),
      );

      it.effect("the device that confirms decides the school, not whoever signed up last", () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const email = "opfer.schule@example.org";
          const mine = yield* reservation;
          const theirs = yield* Effect.map(AccessCodes.reserve(otherCode), ({ token }) => token);

          yield* call("POST", "/sign-up/email", {
            body: { email, password, name: "" },
            reservation: mine,
          });

          // An attacker signs the same address up later, with another school's code.
          yield* call("POST", "/sign-up/email", {
            body: { email, password: "vom-angreifer-gewaehlt", name: "" },
            reservation: theirs,
          });

          yield* TestClock.adjust("1 minute");
          yield* call("POST", "/send-verification-email", { body: { email } });

          const confirmed = yield* call("POST", "/email-otp/verify-email", {
            body: { email, otp: yield* codeFor(email), password },
            reservation: mine,
          });

          const user = yield* userOf(email);

          const admitted = yield* sql<{ readonly school: string }>`
            select school_id as school from school_access where account_id = ${user?.id ?? ""}
          `;

          assert.deepStrictEqual([confirmed.status, admitted], [200, [{ school }]]);
        }),
      );

      it.effect("a confirmation carries the password, and without one confirms nothing", () =>
        Effect.gen(function* () {
          const email = "lena.nopassword@example.org";

          yield* call("POST", "/sign-up/email", {
            body: { email, password, name: "" },
            reservation: yield* reservation,
          });

          const otp = yield* codeFor(email);
          const bare = yield* call("POST", "/email-otp/verify-email", { body: { email, otp } });
          const unconfirmed = (yield* userOf(email))?.emailVerified;

          // The sign-up's password counts for nothing until a confirmation carries it: it is wrong,
          // not merely unconfirmed.
          const early = yield* call("POST", "/sign-in/email", { body: { email, password } });

          assert.deepStrictEqual(
            [bare.status, yield* decodeCode(bare.json), unconfirmed, early.status],
            [400, { code: "PASSWORD_REQUIRED" }, false, 401],
          );
        }),
      );

      it.effect("mails no code to a confirmed address, and its code can't be guessed in", () =>
        Effect.gen(function* () {
          yield* signUp("lena.resend@example.org");

          const resent = yield* call("POST", "/send-verification-email", {
            body: { email: "lena.resend@example.org" },
          });

          const otp = yield* call("POST", "/email-otp/send-verification-otp", {
            body: { email: "lena.resend@example.org", type: "email-verification" },
          });

          const guessed = yield* call("POST", "/email-otp/verify-email", {
            body: { email: "lena.resend@example.org", otp: "000000", password },
          });

          assert.strictEqual(resent.status, 200);
          assert.strictEqual(otp.status, 404);
          assert.strictEqual(guessed.status, 400);
          assert.strictEqual(guessed.token, undefined);
          assert.strictEqual(yield* mailCount("lena.resend@example.org"), 1);
        }),
      );

      it.effect("closes the routes Studienbuch doesn't offer", () =>
        Effect.gen(function* () {
          const token = yield* signUp("lena.routes@example.org");

          const statuses = yield* Effect.forEach(
            [
              ["GET", "/list-sessions"],
              ["POST", "/update-user"],
              ["GET", "/verify-email?token=x"],
              ["POST", "/email-otp/check-verification-otp"],
              ["POST", "/sign-in/email-otp"],
              ["POST", "/forget-password/email-otp"],
              ["POST", "/verify-password"],
              ["POST", "/delete-user"],
            ] as const,
            ([method, path]) =>
              Effect.map(
                call(method, path, { token, body: method === "POST" ? {} : undefined }),
                (answer) => answer.status,
              ),
          );

          assert.deepStrictEqual(statuses, [404, 404, 404, 404, 404, 404, 404, 404]);
        }),
      );

      it.effect("tells the resolver when a session ends at sign-out", () =>
        Effect.gen(function* () {
          const resolver = yield* Ports.SessionResolver;
          const token = yield* signUp("lena.signout@example.org");
          const session = yield* resolver.resolve(bearer(token));
          const revoked = yield* revocations(1);

          const signedOut = yield* call("POST", "/sign-out", { body: {}, token });

          assert.strictEqual(signedOut.status, 200);
          assert.deepStrictEqual(
            [...(yield* Fiber.join(revoked))],
            Option.toArray(Option.map(session, (found) => found.sessionId)),
          );
          assert.isTrue(Option.isNone(yield* resolver.resolve(bearer(token))));
        }),
      );

      it.effect("reports every session that signing out everywhere ends, past a hundred", () =>
        Effect.gen(function* () {
          const db = yield* Database.Drizzle;
          const resolver = yield* Ports.SessionResolver;
          const token = yield* signUp("lena.everywhere@example.org");
          const user = yield* userOf("lena.everywhere@example.org");
          const userId = user?.id ?? "";

          const expiresAt = DateTime.toDateUtc(DateTime.makeUnsafe("2100-01-01T00:00:00Z"));

          yield* db.insert(AuthTables.session).values(
            Array.from({ length: 100 }, (_, index) => ({
              id: `session-${index}`,
              token: `token-${index}`,
              userId,
              expiresAt,
            })),
          );

          const revoked = yield* revocations(101);
          const answer = yield* call("POST", "/revoke-sessions", { body: {}, token });

          assert.strictEqual(answer.status, 200);
          assert.strictEqual(new Set(yield* Fiber.join(revoked)).size, 101);
          assert.isTrue(Option.isNone(yield* resolver.resolve(bearer(token))));
        }),
      );

      it.effect("ends every other device's session when the password changes", () =>
        Effect.gen(function* () {
          const resolver = yield* Ports.SessionResolver;
          const first = yield* signUp("lena.password@example.org");

          const second = yield* call("POST", "/sign-in/email", {
            body: { email: "lena.password@example.org", password },
          });

          const other = yield* resolver.resolve(bearer(second.token ?? ""));
          const revoked = yield* revocations(2);

          const changed = yield* call("POST", "/change-password", {
            token: first,
            body: { currentPassword: password, newPassword: "noch-laenger-456" },
          });

          assert.strictEqual(changed.status, 200);
          assert.includeMembers(
            [...(yield* Fiber.join(revoked))],
            Option.toArray(Option.map(other, (found) => found.sessionId)),
          );
          assert.isTrue(Option.isNone(yield* resolver.resolve(bearer(second.token ?? ""))));
        }),
      );

      // A thief who knows the old password is signed out everywhere once the owner resets it.
      it.effect(
        "resets a forgotten password by mailed code and ends every session of the account",
        () =>
          Effect.gen(function* () {
            const resolver = yield* Ports.SessionResolver;
            const email = "lena.forgot@example.org";
            const first = yield* signUp(email);

            const second = yield* call("POST", "/sign-in/email", { body: { email, password } });

            const sessions = [
              yield* resolver.resolve(bearer(first)),
              yield* resolver.resolve(bearer(second.token ?? "")),
            ];

            const revoked = yield* revocations(2);

            const requested = yield* call("POST", "/email-otp/request-password-reset", {
              body: { email },
            });

            assert.strictEqual(requested.status, 200);

            const reset = yield* call("POST", "/email-otp/reset-password", {
              body: { email, otp: yield* resetCodeFor(email), password: "ganz-neu-4567" },
            });

            assert.strictEqual(reset.status, 200);
            assert.deepStrictEqual(
              [...(yield* Fiber.join(revoked))].sort(),
              sessions
                .flatMap(Option.toArray)
                .map((found) => found.sessionId)
                .sort(),
            );
            assert.isTrue(Option.isNone(yield* resolver.resolve(bearer(first))));

            const [old, renewed] = [
              yield* call("POST", "/sign-in/email", { body: { email, password } }),
              yield* call("POST", "/sign-in/email", { body: { email, password: "ganz-neu-4567" } }),
            ];

            assert.deepStrictEqual([old.status, renewed.status], [401, 200]);
          }),
      );

      // The answer, and how long it takes, must not tell whether an address has an account.
      it.effect("answers an unknown address as it answers a known one, and mails nobody", () =>
        Effect.gen(function* () {
          yield* signUp("lena.known@example.org");

          const [known, unknown] = [
            yield* call("POST", "/email-otp/request-password-reset", {
              body: { email: "lena.known@example.org" },
            }),
            yield* call("POST", "/email-otp/request-password-reset", {
              body: { email: "nobody.here@example.org" },
            }),
          ];

          assert.deepStrictEqual([known.status, known.json], [unknown.status, unknown.json]);
          assert.match(yield* resetCodeFor("lena.known@example.org"), /^\d{6}$/u);
          assert.strictEqual(yield* mailCount("nobody.here@example.org"), 0);

          const guessed = yield* call("POST", "/email-otp/reset-password", {
            body: { email: "nobody.here@example.org", otp: "000000", password: "ganz-neu-4567" },
          });

          assert.strictEqual(guessed.status, 400);
          assert.deepStrictEqual(yield* decodeCode(guessed.json), { code: "INVALID_OTP" });
        }),
      );

      // A mailed code never signs a device in by itself (#35): the reset code sets a password,
      // and the device signs in with it.
      it.effect("mails an unconfirmed address a confirmation code, never a reset code", () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const email = "lena.unconfirmed@example.org";
          const held = yield* reservation;

          yield* call("POST", "/sign-up/email", {
            body: { email, password, name: "" },
            reservation: held,
          });

          // The sign-up's own confirmation mail goes first.
          yield* mailTo(email, (message) => !message.subject.includes("Passwort"));
          yield* call("POST", "/email-otp/request-password-reset", { body: { email } });

          // What the reset request mailed: a confirmation code, which no reset accepts.
          const mailed = yield* mailTo(email, () => true);
          const code = /\b(?<code>\d{6})\b/u.exec(mailed.text)?.groups?.code ?? "no code";

          const reset = yield* call("POST", "/email-otp/reset-password", {
            body: { email, otp: code, password: "ganz-neu-4567" },
          });

          const confirmed = yield* call("POST", "/email-otp/verify-email", {
            body: { email, otp: code, password },
            reservation: held,
          });

          const admitted = yield* sql<{ readonly school: string }>`
            select a.school_id as school from school_access a
            join auth_user u on u.id = a.account_id where u.email = ${email}
          `;

          assert.deepStrictEqual(
            {
              mail: mailed.subject.includes("Passwort") ? "reset" : "confirmation",
              reset: `${reset.status} ${reset.text}`,
              confirmed: confirmed.status,
              admitted,
            },
            {
              mail: "confirmation",
              reset: `400 {"message":"Invalid OTP","code":"INVALID_OTP"}`,
              confirmed: 200,
              admitted: [{ school }],
            },
          );
        }),
      );

      // Better Auth counts wrong tries and expiry only where a code exists, so their error codes
      // would tell an address with an account from one without.
      it.effect("answers a wrong, spent or expired code the same, account or not", () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;

          const expire = (email: string) => sql`
            update auth_verification set "expiresAt" = now() - interval '1 minute'
            where identifier like ${`%-otp-${email}`}
          `;

          const tries = (
            path: string,
            email: string,
            code: string,
            extra: { readonly password?: string },
          ) =>
            Effect.forEach([1, 2, 3, 4, 5, 6], () =>
              call("POST", path, { body: { email, otp: code, ...extra } }),
            );

          const reset = Effect.fnUntraced(function* (email: string) {
            const request = call("POST", "/email-otp/request-password-reset", { body: { email } });
            const extra = { password: "ganz-neu-4567" };

            yield* request;
            const first = email.startsWith("lena") ? yield* resetCodeFor(email) : "123456";
            const wrong = yield* tries("/email-otp/reset-password", email, wrongCode(first), extra);

            yield* request;
            const second = email.startsWith("lena") ? yield* resetCodeFor(email) : "123456";
            yield* expire(email);

            const expired = yield* call("POST", "/email-otp/reset-password", {
              body: { email, otp: second, ...extra },
            });

            return yield* outcomes([...wrong, expired]);
          });

          const confirm = Effect.fnUntraced(function* (email: string) {
            const request = call("POST", "/send-verification-email", { body: { email } });
            const extra = { password };

            yield* request;
            const first = email.startsWith("lena") ? yield* codeFor(email) : "123456";
            const wrong = yield* tries("/email-otp/verify-email", email, wrongCode(first), extra);

            yield* request;
            const second = email.startsWith("lena") ? yield* codeFor(email) : "123456";
            yield* expire(email);

            const expired = yield* call("POST", "/email-otp/verify-email", {
              body: { email, otp: second, ...extra },
            });

            return yield* outcomes([...wrong, expired]);
          });

          yield* signUp("lena.tries@example.org");
          yield* call("POST", "/sign-up/email", {
            body: { email: "lena.unconfirmed.tries@example.org", password, name: "" },
            reservation: yield* reservation,
          });

          const everyAnswer = Array.from(
            { length: 7 },
            () => `400 {"message":"Invalid OTP","code":"INVALID_OTP"}`,
          );

          assert.deepStrictEqual(
            {
              reset: yield* reset("lena.tries@example.org"),
              resetUnknown: yield* reset("nobody.tries@example.org"),
              confirm: yield* confirm("lena.unconfirmed.tries@example.org"),
              confirmUnknown: yield* confirm("nobody.confirm@example.org"),
            },
            {
              reset: everyAnswer,
              resetUnknown: everyAnswer,
              confirm: everyAnswer,
              confirmUnknown: everyAnswer,
            },
          );
        }),
      );

      // Anything else would leave a code row for any string, as long as it is.
      it.effect("answers a reset request for no address alike, and starts nothing for it", () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const notAddresses = ["x".repeat(100_000), `${"a".repeat(250)}@example.org`, "lena"];

          const answers = yield* Effect.forEach(notAddresses, (email) =>
            call("POST", "/email-otp/request-password-reset", { body: { email } }),
          );

          // The jobs run in order; once this one mailed, the ones before it are done.
          yield* signUp("lena.after@example.org");
          yield* call("POST", "/email-otp/request-password-reset", {
            body: { email: "lena.after@example.org" },
          });
          yield* resetMailTo("lena.after@example.org");

          const [rows] = yield* sql<{ readonly count: number }>`
            select count(*)::int as count from auth_verification
            where identifier = any(${notAddresses.map((email) => `forget-password-otp-${email}`)})
          `;

          assert.deepStrictEqual(
            answers.map((answer) => `${answer.status} ${answer.text}`),
            notAddresses.map(() => `200 {"success":true}`),
          );
          assert.strictEqual(rows?.count, 0);
        }),
      );

      // Many clients could otherwise take turns guessing, and flood a student's inbox.
      it.effect("mails at most five reset codes an hour to one address", () =>
        Effect.gen(function* () {
          const email = "lena.flooded@example.org";

          yield* signUp(email);

          const answers = yield* Effect.forEach([1, 2, 3, 4, 5, 6], () =>
            call("POST", "/email-otp/request-password-reset", { body: { email } }),
          );

          yield* Effect.forEach([1, 2, 3, 4, 5], () => resetCodeFor(email));

          assert.deepStrictEqual(
            answers.map((answer) => answer.status),
            [200, 200, 200, 200, 200, 200],
          );
          // The sign-up code and five reset codes.
          assert.strictEqual(yield* mailCount(email), 6);
        }),
      );

      // Six digits hash back in milliseconds, so a plain hash would hand a reader of the table
      // every pending code.
      it.effect("keeps mailed codes only as a hash keyed with the server's secret", () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const email = "lena.stored@example.org";

          yield* signUp(email);
          yield* call("POST", "/email-otp/request-password-reset", { body: { email } });

          const code = yield* resetCodeFor(email);

          const [row] = yield* sql<{ readonly value: string }>`
            select value from auth_verification where identifier = ${`forget-password-otp-${email}`}
          `;

          const stored = row?.value.split(":")[0] ?? "";

          const unkeyed = Base64Url.encode(
            new Uint8Array(
              yield* Effect.promise(() =>
                crypto.subtle.digest("SHA-256", new TextEncoder().encode(code)),
              ),
            ),
          );

          assert.isNotEmpty(stored);
          assert.notInclude(stored, code);
          assert.notStrictEqual(stored, unkeyed);
        }),
      );

      // A thief may have added a passkey, which a new password doesn't remove. The student
      // learns how many the account has, and since when.
      it.effect("lists the account's passkeys in the reset mail", () =>
        Effect.gen(function* () {
          const email = "lena.passkeys@example.org";

          yield* addPasskey(yield* signUp(email));
          yield* call("POST", "/email-otp/request-password-reset", { body: { email } });

          const mail = yield* resetMailTo(email);

          assert.include(mail.text, "Auf deinem Konto ist 1 Passkey eingerichtet");
        }),
      );

      // A school's network reaches the server from one address, so a client's limit is a ceiling.
      it.effect("gives a client a ceiling per route, high enough for a school", () =>
        Effect.gen(function* () {
          const from = "192.0.2.10";

          const statuses = (path: string) =>
            Effect.map(
              Effect.forEach(
                Array.from({ length: Limits.perClient + 1 }, (_, index) => index),
                (index) =>
                  call("POST", path, { from, body: { email: `lena.ceiling${index}@example.org` } }),
                { concurrency: "unbounded" },
              ),
              (answers) =>
                [200, 429].map(
                  (status) => answers.filter((answer) => answer.status === status).length,
                ),
            );

          const resends = yield* statuses("/send-verification-email");
          const resets = yield* statuses("/email-otp/request-password-reset");

          const elsewhere = yield* call("POST", "/send-verification-email", {
            from: "192.0.2.11",
            body: { email: "lena.ceiling.elsewhere@example.org" },
          });

          yield* TestClock.adjust(Limits.clientWindow);

          const later = yield* call("POST", "/send-verification-email", {
            from,
            body: { email: "lena.ceiling.later@example.org" },
          });

          assert.deepStrictEqual(
            { resends, resets, elsewhere: elsewhere.status, later: later.status },
            {
              resends: [Limits.perClient, 1],
              resets: [Limits.perClient, 1],
              elsewhere: 200,
              later: 200,
            },
          );
        }),
      );

      // A class signs up in one lesson, all from its school's one address.
      it.effect("lets a class behind one address sign up, confirm and sign in together", () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const from = "198.51.100.30";

          const students = Array.from(
            { length: 30 },
            (_, index) => `klasse7b.${index}@example.org`,
          );

          const answers = yield* Effect.forEach(students, (email) =>
            Effect.gen(function* () {
              const held = yield* reservation;

              const signedUp = yield* call("POST", "/sign-up/email", {
                from,
                body: { email, password, name: "" },
                reservation: held,
              });

              const confirmed = yield* call("POST", "/email-otp/verify-email", {
                from,
                body: { email, otp: yield* codeFor(email), password },
                reservation: held,
              });

              const signedIn = yield* call("POST", "/sign-in/email", {
                from,
                body: { email, password },
              });

              return `${signedUp.status} ${confirmed.status} ${signedIn.status}`;
            }),
          );

          const [admitted] = yield* sql<{ readonly count: number }>`
            select count(*)::int as count from school_access a
            join auth_user u on u.id = a.account_id
            where u.email like 'klasse7b.%' and a.school_id = ${school}
          `;

          assert.deepStrictEqual(
            { answers: new Set(answers), admitted: admitted?.count },
            { answers: new Set(["200 200 200"]), admitted: 30 },
          );
        }),
      );

      // Better Auth gives a code five tries, and an address gets five resent codes an hour, so its
      // codes take at most thirty guesses an hour, from one client or from many.
      it.effect("stops one client guessing the codes of one address", () =>
        Effect.gen(function* () {
          const from = "198.51.100.31";
          const email = "lena.guessed@example.org";
          const held = yield* reservation;

          yield* call("POST", "/sign-up/email", {
            from,
            body: { email, password, name: "" },
            reservation: held,
          });

          const confirm = (otp: string) =>
            call("POST", "/email-otp/verify-email", {
              from,
              body: { email, otp, password },
              reservation: held,
            });

          // Each mail a minute apart, so the newest captured one is the last code sent.
          const resend = Effect.andThen(
            TestClock.adjust("1 minute"),
            call("POST", "/send-verification-email", { from, body: { email } }),
          );

          const round = Effect.gen(function* () {
            yield* resend;
            const sent = yield* codeFor(email);

            return yield* Effect.forEach([1, 2, 3, 4, 5], () => confirm(wrongCode(sent)));
          });

          const guesses = yield* Effect.forEach([1, 2, 3, 4, 5, 6], () => round);
          const mailed = yield* mailCount(email);
          const right = yield* confirm(yield* codeFor(email));

          yield* TestClock.adjust("1 hour");
          yield* resend;
          const later = yield* confirm(yield* codeFor(email));

          const answer = (response: { readonly status: number; readonly text: string }) =>
            `${response.status} ${response.text}`;

          assert.deepStrictEqual(
            {
              guesses: new Set(guesses.flat().map(answer)),
              mailed,
              right: answer(right),
              later: later.status,
            },
            {
              guesses: new Set([`400 {"message":"Invalid OTP","code":"INVALID_OTP"}`]),
              // The sign-up's code and five resent ones; the sixth resend mails nothing.
              mailed: 6,
              right: `400 {"message":"Invalid OTP","code":"INVALID_OTP"}`,
              later: 200,
            },
          );
        }),
      );

      it.effect("stops guessing the password of one address, from one client or from many", () =>
        Effect.gen(function* () {
          const email = "lena.guessed.password@example.org";
          const neighbour = "lena.neighbour@example.org";
          const from = "198.51.100.32";

          yield* signUp(email);
          yield* signUp(neighbour);

          const signIn = (address: string, secret: string, client = from) =>
            Effect.map(
              call("POST", "/sign-in/email", {
                from: client,
                body: { email: address, password: secret },
              }),
              (answer) => answer.status,
            );

          // At once, so a guess counts before its password is checked.
          const wrong = yield* Effect.forEach(
            Array.from({ length: 30 }, (_, index) => `falsch-geraten-${index}`),
            (guess) => signIn(email, guess),
            { concurrency: "unbounded" },
          );

          const right = yield* signIn(email, password);
          const elsewhere = yield* signIn(email, password, "198.51.100.33");
          const sameClient = yield* signIn(neighbour, password);

          yield* TestClock.adjust(Limits.clientWindow);
          const later = yield* signIn(email, password);

          assert.deepStrictEqual(
            {
              wrong: [401, 429].map((status) => wrong.filter((each) => each === status).length),
              right,
              elsewhere,
              sameClient,
              later,
            },
            { wrong: [10, 20], right: 429, elsewhere: 429, sameClient: 200, later: 200 },
          );
        }),
      );

      it.effect("counts a wrong current password like a wrong one at sign-in", () =>
        Effect.gen(function* () {
          const email = "lena.changing@example.org";
          const token = yield* signUp(email);

          const change = (currentPassword: string) =>
            Effect.map(
              call("POST", "/change-password", {
                token,
                body: { currentPassword, newPassword: "ganz-neu-4567" },
              }),
              (answer) => answer.status,
            );

          const wrong = yield* Effect.forEach(
            Array.from({ length: 10 }, (_, index) => `falsch-geraten-${index}`),
            change,
          );

          const right = yield* change(password);
          const signIn = yield* call("POST", "/sign-in/email", { body: { email, password } });

          assert.deepStrictEqual(
            { wrong: new Set(wrong), right, signIn: signIn.status },
            { wrong: new Set([400]), right: 429, signIn: 429 },
          );
        }),
      );

      // A sign-up or confirmation that did its work for a code with a use limit gives its count
      // back, so a year group behind its school's one address spends the ceiling on failures only.
      it.effect("lets a year group of 180 behind one address sign up and confirm", () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const from = "198.51.100.40";

          const { code } = yield* AccessCodes.mint({
            school,
            kind: "student",
            maxUses: Option.some(180),
          });

          const students = Array.from(
            { length: 180 },
            (_, index) => `jahrgang8.${index}@example.org`,
          );

          const answers = yield* Effect.forEach(
            students,
            (email) =>
              Effect.gen(function* () {
                const { token: held } = yield* AccessCodes.reserve(code);

                const signedUp = yield* call("POST", "/sign-up/email", {
                  from,
                  body: { email, password, name: "" },
                  reservation: held,
                });

                const confirmed = yield* call("POST", "/email-otp/verify-email", {
                  from,
                  body: { email, otp: yield* codeFor(email), password },
                  reservation: held,
                });

                return `${signedUp.status} ${confirmed.status}`;
              }),
            { concurrency: 10 },
          );

          const [admitted] = yield* sql<{ readonly count: number }>`
            select count(*)::int as count from school_access a
            join auth_user u on u.id = a.account_id
            where u.email like 'jahrgang8.%' and a.school_id = ${school}
          `;

          assert.deepStrictEqual(
            { answers: new Set(answers), admitted: admitted?.count },
            { answers: new Set(["200 200"]), admitted: 180 },
          );
        }),
      );

      // A classmate's junk counts against the classmate's own client, so it can't block the class.
      it.effect("lets a class confirm after someone sends junk with its code", () =>
        Effect.gen(function* () {
          const { code } = yield* AccessCodes.mint({
            school,
            kind: "student",
            maxUses: Option.some(4),
          });

          const { token: junk } = yield* AccessCodes.reserve(code);

          yield* Effect.forEach(
            Array.from({ length: 12 }, (_, index) => index),
            (index) =>
              call("POST", "/email-otp/verify-email", {
                from: "198.51.100.50",
                body: { email: `nobody.${index}@example.org`, otp: "123456", password },
                reservation: junk,
              }),
          );

          const email = "lena.klassenkamerad@example.org";
          const { token: held } = yield* AccessCodes.reserve(code);

          const signedUp = yield* call("POST", "/sign-up/email", {
            from: "198.51.100.51",
            body: { email, password, name: "" },
            reservation: held,
          });

          const confirmed = yield* call("POST", "/email-otp/verify-email", {
            from: "198.51.100.51",
            body: { email, otp: yield* codeFor(email), password },
            reservation: held,
          });

          assert.deepStrictEqual([signedUp.status, confirmed.status], [200, 200]);
        }),
      );

      // Redeeming is free, so a code's sign-ups give their client's count back only up to three
      // per use, and a code can't mail past the ceiling from one client.
      it.effect("gives back at most three sign-ups per use of a code", () =>
        Effect.gen(function* () {
          const from = "198.51.100.52";

          const { code } = yield* AccessCodes.mint({
            school,
            kind: "student",
            maxUses: Option.some(4),
          });

          const statuses = yield* Effect.forEach(
            Array.from({ length: 12 + Limits.perClient + 1 }, (_, index) => index),
            (index) =>
              Effect.gen(function* () {
                const { token } = yield* AccessCodes.reserve(code);

                const answer = yield* call("POST", "/sign-up/email", {
                  from,
                  body: { email: `fremd.${index}@example.org`, password, name: "" },
                  reservation: token,
                });

                return answer.status;
              }),
          );

          assert.deepStrictEqual(
            [200, 429].map((status) => statuses.filter((each) => each === status).length),
            [12 + Limits.perClient, 1],
          );
        }),
      );

      it.effect(
        "asks for user verification in every passkey ceremony, and refuses one without",
        () =>
          Effect.gen(function* () {
            const resolver = yield* Ports.SessionResolver;
            const token = yield* signUp("lena.passkey@example.org");
            const authenticator = yield* VirtualAuthenticator.make;

            const offered = yield* call("GET", "/passkey/generate-register-options", { token });
            const registration = yield* decodeRegistrationOptions(offered.json);

            assert.deepStrictEqual(registration.authenticatorSelection, {
              residentKey: "required",
              userVerification: "required",
            });
            assert.strictEqual(offered.cookies, null);

            const unverified = yield* call("POST", "/passkey/verify-registration", {
              token,
              challenge: offered.challenge,
              body: { response: authenticator.create(registration, { verified: false }) },
            });

            assert.deepStrictEqual(yield* decodeCode(unverified.json), {
              code: "FAILED_TO_VERIFY_REGISTRATION",
            });

            const again = yield* call("GET", "/passkey/generate-register-options", { token });

            const registered = yield* call("POST", "/passkey/verify-registration", {
              token,
              challenge: again.challenge,
              body: {
                response: authenticator.create(yield* decodeChallenge(again.json), {
                  verified: true,
                }),
              },
            });

            assert.strictEqual(registered.status, 200);

            const asked = yield* call("GET", "/passkey/generate-authenticate-options");
            const authentication = yield* decodeAuthenticationOptions(asked.json);

            assert.strictEqual(authentication.userVerification, "required");

            const refused = yield* call("POST", "/passkey/verify-authentication", {
              challenge: asked.challenge,
              body: { response: yield* authenticator.get(authentication, { verified: false }) },
            });

            assert.deepStrictEqual(yield* decodeCode(refused.json), {
              code: "AUTHENTICATION_FAILED",
            });

            // A page on another site can't finish a ceremony, even with the challenge.
            const foreign = yield* call("GET", "/passkey/generate-authenticate-options");

            const forged = yield* call("POST", "/passkey/verify-authentication", {
              challenge: foreign.challenge,
              origin: "https://elsewhere.example",
              body: {
                response: yield* authenticator.get(yield* decodeChallenge(foreign.json), {
                  verified: true,
                }),
              },
            });

            assert.strictEqual(forged.status, 403);

            // Native apps send no Origin at all.
            const next = yield* call("GET", "/passkey/generate-authenticate-options");

            const signedIn = yield* call("POST", "/passkey/verify-authentication", {
              challenge: next.challenge,
              origin: null,
              body: {
                response: yield* authenticator.get(yield* decodeChallenge(next.json), {
                  verified: true,
                }),
              },
            });

            assert.strictEqual(signedIn.status, 200);
            assert.strictEqual(signedIn.cookies, null);

            const accountOf = (found: Option.Option<Ports.ResolvedSession>) =>
              Option.map(found, ({ accountId }) => accountId);

            assert.deepStrictEqual(
              accountOf(yield* resolver.resolve(bearer(signedIn.token ?? ""))),
              accountOf(yield* resolver.resolve(bearer(token))),
            );
          }),
      );
      it.effect(
        "adds a passkey only within ten minutes of a sign-in, and a new passkey signs nobody in",
        () =>
          Effect.gen(function* () {
            const resolver = yield* Ports.SessionResolver;
            const sql = yield* SqlClient.SqlClient;
            const token = yield* signUp("lena.recent@example.org");
            const authenticator = yield* VirtualAuthenticator.make;
            const session = yield* resolver.resolve(bearer(token));

            const sessionId = Option.match(session, {
              onNone: () => "",
              onSome: (s) => s.sessionId,
            });

            const signedInAgo = (minutes: number) => sql`
              update auth_session set "createdAt" = now() - make_interval(mins => ${minutes})
              where id = ${sessionId}
            `;

            yield* signedInAgo(11);
            const stale = yield* call("GET", "/passkey/generate-register-options", { token });
            yield* signedInAgo(9);
            const offered = yield* call("GET", "/passkey/generate-register-options", { token });

            const registered = yield* call("POST", "/passkey/verify-registration", {
              token,
              challenge: offered.challenge,
              body: {
                createSession: true,
                response: authenticator.create(yield* decodeChallenge(offered.json), {
                  verified: true,
                }),
              },
            });

            const [sessions] = yield* sql<{ readonly count: number }>`
              select count(*)::int as count from auth_session s
              join auth_user u on u.id = s."userId"
              where u.email = 'lena.recent@example.org'
            `;

            assert.deepStrictEqual(
              {
                stale: stale.status,
                registered: registered.status,
                token: registered.token,
                sessions: sessions?.count,
              },
              { stale: 403, registered: 200, token: undefined, sessions: 1 },
            );
          }),
      );
    });

    it.layer(server("beta"))((it) => {
      it.effect("refuses a sign-up without a school's access code, as everywhere", () =>
        Effect.gen(function* () {
          const created = yield* call("POST", "/sign-up/email", {
            body: { email: "lena@example.org", password, name: "" },
          });

          const forged = yield* call("POST", "/sign-up/email", {
            body: { email: "lena@example.org", password, name: "" },
            reservation: "a reservation this server never gave out",
          });

          assert.deepStrictEqual(
            [created.status, yield* decodeCode(created.json), forged.status],
            [400, { code: Access.reservationRefused }, 400],
          );

          const listed = yield* Effect.flip(Mail.captured);

          assert.strictEqual(listed._tag, "Mail.NotCaptured");
        }),
      );
    });

    it.effect(
      "doesn't start with a short secret, a foreign passkey host or captured mail in beta",
      () =>
        Effect.gen(function* () {
          const failure = (environment: string, overrides: Record<string, string>) =>
            Effect.map(
              Effect.flip(Effect.scoped(Layer.build(server(environment, overrides)))),
              (error) => ("_tag" in error ? error._tag : "untagged"),
            );

          assert.deepStrictEqual(
            [
              // An empty variable is no value to Config; an empty secret file reads as "", a weak secret.
              yield* failure("development", { AUTH_SECRET: "" }),
              yield* failure("development", { AUTH_SECRET: "x".repeat(31) }),
              yield* failure("development", { PASSKEY_RP_ID: "studienbuch.app" }),
              yield* failure("beta", { MAIL_URL: "capture:" }),
            ],
            ["ConfigError", "Auth.WeakSecret", "Auth.ForeignRpId", "Mail.CaptureNotAllowed"],
          );
        }),
    );
  });
});

interface Ceremony {
  readonly challenge: string;
}

/**
 * A platform authenticator with one P-256 key. It answers WebAuthn ceremonies for `localhost` the
 * way a phone does, with or without user verification.
 */
const VirtualAuthenticator = {
  make: Effect.gen(function* () {
    const keys = yield* Effect.promise(() =>
      crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]),
    );

    const jwk = yield* Effect.promise(() => crypto.subtle.exportKey("jwk", keys.publicKey));
    const credentialId = crypto.getRandomValues(new Uint8Array(16));
    const id = Base64Url.encode(credentialId);
    const rpIdHash = yield* sha256(new TextEncoder().encode("localhost"));

    // The COSE form of the public key: kty EC2, alg ES256, crv P-256, then x and y.
    const coseKey = concat(
      Uint8Array.of(0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20),
      decode(jwk.x),
      Uint8Array.of(0x22, 0x58, 0x20),
      decode(jwk.y),
    );

    const clientData = (type: string, { challenge }: Ceremony) =>
      new TextEncoder().encode(
        JSON.stringify({ type, challenge, origin: publicUrl, crossOrigin: false }),
      );

    // User present, verified when asked, and attested credential data on registration.
    const flags = (verified: boolean, attested: boolean) =>
      0x01 | (verified ? 0x04 : 0) | (attested ? 0x40 : 0);

    return {
      create: (ceremony: Ceremony, { verified }: { readonly verified: boolean }) => {
        const authData = concat(
          rpIdHash,
          Uint8Array.of(flags(verified, true), 0, 0, 0, 0),
          new Uint8Array(16),
          Uint8Array.of(0, credentialId.length),
          credentialId,
          coseKey,
        );

        const attestationObject = concat(
          Uint8Array.of(0xa3),
          cborText("fmt"),
          cborText("none"),
          cborText("attStmt"),
          Uint8Array.of(0xa0),
          cborText("authData"),
          Uint8Array.of(0x58, authData.length),
          authData,
        );

        return {
          id,
          rawId: id,
          type: "public-key",
          authenticatorAttachment: "platform",
          clientExtensionResults: {},
          response: {
            clientDataJSON: Base64Url.encode(clientData("webauthn.create", ceremony)),
            attestationObject: Base64Url.encode(attestationObject),
            transports: ["internal"],
          },
        };
      },
      get: Effect.fnUntraced(function* (
        ceremony: Ceremony,
        { verified }: { readonly verified: boolean },
      ) {
        const authenticatorData = concat(
          rpIdHash,
          Uint8Array.of(flags(verified, false), 0, 0, 0, 1),
        );

        const clientDataJSON = clientData("webauthn.get", ceremony);
        const signed = concat(authenticatorData, yield* sha256(clientDataJSON));

        const signature = yield* Effect.promise(() =>
          crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, signed),
        );

        return {
          id,
          rawId: id,
          type: "public-key",
          clientExtensionResults: {},
          response: {
            clientDataJSON: Base64Url.encode(clientDataJSON),
            authenticatorData: Base64Url.encode(authenticatorData),
            signature: Base64Url.encode(derSignature(new Uint8Array(signature))),
          },
        };
      }),
    };
  }),
};

const sha256 = (bytes: Uint8Array<ArrayBuffer>) =>
  Effect.map(
    Effect.promise(() => crypto.subtle.digest("SHA-256", bytes)),
    (digest) => new Uint8Array(digest),
  );

const concat = (...parts: ReadonlyArray<Uint8Array>) => {
  const out = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;

  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
};

const decode = (base64url: string | undefined) =>
  Result.getOrElse(Base64Url.decode(base64url ?? ""), () => new Uint8Array());

// A CBOR text string shorter than 24 bytes.
const cborText = (text: string) =>
  concat(Uint8Array.of(0x60 + text.length), new TextEncoder().encode(text));

// WebCrypto signs ECDSA as r and s side by side; WebAuthn carries them DER-encoded.
const derSignature = (raw: Uint8Array) => {
  const integer = (bytes: Uint8Array) => {
    const start = bytes.findIndex((byte) => byte !== 0);
    const trimmed = bytes.slice(start === -1 ? bytes.length - 1 : start);
    const padded = (trimmed[0] ?? 0) >= 0x80 ? concat(Uint8Array.of(0), trimmed) : trimmed;

    return concat(Uint8Array.of(0x02, padded.length), padded);
  };

  const body = concat(integer(raw.slice(0, 32)), integer(raw.slice(32)));

  return concat(Uint8Array.of(0x30, body.length), body);
};
