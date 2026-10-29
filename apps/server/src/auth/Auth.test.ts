import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, layer } from "@effect/vitest";
import { Accounts } from "@stu/api/Accounts";
import { Ports } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import { desc } from "drizzle-orm";
import * as ConfigProvider from "effect/ConfigProvider";
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
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import * as NodeURL from "node:url";
import { Deployment } from "../infra/config/Deployment.ts";
import { Database } from "../infra/database/Database.ts";
import { Migrations } from "../infra/database/Migrations.ts";
import { Mail } from "../infra/mail/Mail.ts";
import { MailTables } from "../infra/mail/MailTables.ts";
import { Auth } from "./Auth.ts";
import { AuthTables } from "./AuthTables.ts";

const publicUrl = "http://localhost:3000";
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
        Layer.provideMerge(Mail.layer),
        Layer.provideMerge(Database.layer),
        Layer.provideMerge(Deployment.layer),
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
      );
    }),
  ).pipe(Layer.provide(Postgres18.database(Postgres18.socket ?? "")));

interface CallOptions {
  readonly body?: object;
  readonly token?: string;
  readonly challenge?: string;
  /** A browser's own origin by default. Native apps send none (`null`). */
  readonly origin?: string | null;
}

/**
 * One call to Better Auth, as a device makes it: JSON, a bearer token and no cookie jar. Better
 * Auth's rate limits are per client address and shared by every instance in the process, so each
 * call comes from an address of its own.
 */
const call = Effect.fnUntraced(function* (
  method: "GET" | "POST",
  path: string,
  options: CallOptions = {},
) {
  const client = yield* HttpClient.HttpClient;
  const address = `10.${crypto.getRandomValues(new Uint8Array(3)).join(".")}`;

  let request = HttpClientRequest.make(method)(`${Accounts.path}${path}`, {
    headers: { "x-forwarded-for": address },
  });

  if (options.token !== undefined) {
    request = HttpClientRequest.bearerToken(request, options.token);
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

  return {
    status: response.status,
    json: yield* Effect.orElseSucceed(response.json, () => null),
    cookies: response.headers["set-cookie"] ?? null,
    challenge: Option.getOrUndefined(Headers.get(response.headers, Accounts.challengeHeader)),
    token: Option.getOrUndefined(Headers.get(response.headers, "set-auth-token")),
  };
});

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

const mailCount = Effect.flatMap(Database.Drizzle, (db) => db.$count(MailTables.capturedMail));

/** The six digits of the newest captured mail, which went to `email`. */
const codeFor = Effect.fnUntraced(function* (email: string) {
  const db = yield* Database.Drizzle;

  const [mail] = yield* db
    .select()
    .from(MailTables.capturedMail)
    .orderBy(desc(MailTables.capturedMail.sentAt));

  assert.strictEqual(mail?.to, email);

  return /\b(?<code>\d{6})\b/u.exec(mail?.text ?? "")?.groups?.code ?? "no code";
});

/** Signs up, enters the mailed code, and returns the signed token the device keeps. */
const signUp = Effect.fnUntraced(function* (email: string) {
  const created = yield* call("POST", "/sign-up/email", {
    body: { email, password, name: "Lena Beispiel" },
  });

  assert.strictEqual(created.status, 200);

  const verified = yield* call("POST", "/email-otp/verify-email", {
    body: { email, otp: yield* codeFor(email) },
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

describe.skipIf(Postgres18.socket === null)("Auth", () => {
  layer(NodeServices.layer)((it) => {
    it.layer(server("development"), { buildPerTest: true })((it) => {
      it.effect("opens sign-up in development, and the mailed code signs the device in", () =>
        Effect.gen(function* () {
          const resolver = yield* Ports.SessionResolver;
          const db = yield* Database.Drizzle;

          const short = yield* call("POST", "/sign-up/email", {
            body: { email: "lena@example.org", password: "123456789", name: "" },
          });

          assert.strictEqual(short.status, 400);
          assert.deepStrictEqual(yield* decodeCode(short.json), { code: "PASSWORD_TOO_SHORT" });

          const token = yield* signUp("lena@example.org");

          assert.isTrue(Option.isSome(yield* resolver.resolve(bearer(token))));
          assert.isTrue(Option.isNone(yield* resolver.resolve(Headers.empty)));

          // The name lives in the encrypted notebook, whatever sign-up sent.
          const [user] = yield* db.select().from(AuthTables.user);

          assert.deepStrictEqual([user?.name, user?.image], ["", null]);

          // The console lists the code's mail for whoever tests the sign-up.
          const mails = yield* Mail.captured;

          assert.deepStrictEqual(
            mails.map((mail) => mail.to),
            ["lena@example.org"],
          );
        }),
      );

      it.effect("mails no code to a confirmed address, and its code can't be guessed in", () =>
        Effect.gen(function* () {
          yield* signUp("lena@example.org");

          const resent = yield* call("POST", "/send-verification-email", {
            body: { email: "lena@example.org" },
          });

          const otp = yield* call("POST", "/email-otp/send-verification-otp", {
            body: { email: "lena@example.org", type: "email-verification" },
          });

          const guessed = yield* call("POST", "/email-otp/verify-email", {
            body: { email: "lena@example.org", otp: "000000" },
          });

          assert.strictEqual(resent.status, 200);
          assert.strictEqual(otp.status, 404);
          assert.strictEqual(guessed.status, 400);
          assert.strictEqual(guessed.token, undefined);
          assert.strictEqual(yield* mailCount, 1);
        }),
      );

      it.effect("closes the routes Studienbuch doesn't offer", () =>
        Effect.gen(function* () {
          const token = yield* signUp("lena@example.org");

          const statuses = yield* Effect.forEach(
            [
              ["GET", "/list-sessions"],
              ["POST", "/update-user"],
              ["GET", "/verify-email?token=x"],
              ["POST", "/email-otp/check-verification-otp"],
              ["POST", "/sign-in/email-otp"],
            ] as const,
            ([method, path]) =>
              Effect.map(
                call(method, path, { token, body: method === "POST" ? {} : undefined }),
                (answer) => answer.status,
              ),
          );

          assert.deepStrictEqual(statuses, [404, 404, 404, 404, 404]);
        }),
      );

      it.effect("tells the resolver when a session ends at sign-out", () =>
        Effect.gen(function* () {
          const resolver = yield* Ports.SessionResolver;
          const token = yield* signUp("lena@example.org");
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
          const token = yield* signUp("lena@example.org");
          const [user] = yield* db.select().from(AuthTables.user);
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
          const first = yield* signUp("lena@example.org");

          const second = yield* call("POST", "/sign-in/email", {
            body: { email: "lena@example.org", password },
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

      it.effect(
        "asks for user verification in every passkey ceremony, and refuses one without",
        () =>
          Effect.gen(function* () {
            const resolver = yield* Ports.SessionResolver;
            const token = yield* signUp("lena@example.org");
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
    });

    it.layer(server("beta"), { buildPerTest: true })((it) => {
      it.effect("refuses sign-up outside development and preview", () =>
        Effect.gen(function* () {
          const created = yield* call("POST", "/sign-up/email", {
            body: { email: "lena@example.org", password, name: "" },
          });

          assert.strictEqual(created.status, 400);
          assert.deepStrictEqual(yield* decodeCode(created.json), {
            code: "EMAIL_PASSWORD_SIGN_UP_DISABLED",
          });

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
              // An empty secret file reads as no secret at all.
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
