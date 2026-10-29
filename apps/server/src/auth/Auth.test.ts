import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, layer } from "@effect/vitest";
import { Accounts } from "@stu/api/Accounts";
import { Ports } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import { desc } from "drizzle-orm";
import * as ConfigProvider from "effect/ConfigProvider";
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

const publicUrl = "http://localhost:3000";
const migrations = NodeURL.fileURLToPath(new URL("../../migrations/", import.meta.url));

/** The auth route on a fresh database with every migration, in one environment. */
const server = (environment: string) =>
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
        MAIL_URL: "capture:",
        MAIL_FROM: "Studienbuch <studienbuch@localhost>",
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

  if (options.body !== undefined) {
    request = HttpClientRequest.bodyJsonUnsafe(request, options.body);
  }

  const response = yield* client.execute(request);

  return {
    status: response.status,
    json: yield* response.json,
    cookies: response.headers["set-cookie"] ?? null,
    challenge: Option.getOrUndefined(Headers.get(response.headers, Accounts.challengeHeader)),
  };
});

const SignedIn = Schema.Struct({ token: Schema.String });
const decodeSignedIn = Schema.decodeUnknownEffect(SignedIn);
const decodePasskeySignedIn = Schema.decodeUnknownEffect(Schema.Struct({ session: SignedIn }));
const decodeRefused = Schema.decodeUnknownEffect(Schema.Struct({ code: Schema.String }));
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

/** Signs up, enters the mailed code, and returns the session token that signs the device in. */
const signUp = Effect.fnUntraced(function* (email: string) {
  const created = yield* call("POST", "/sign-up/email", {
    body: { email, password: "lange-genug-123", name: "" },
  });

  assert.strictEqual(created.status, 200);

  const verified = yield* call("POST", "/email-otp/verify-email", {
    body: { email, otp: yield* codeFor(email) },
  });

  assert.strictEqual(verified.status, 200);
  assert.strictEqual(verified.cookies, null);

  return (yield* decodeSignedIn(verified.json)).token;
});

describe.skipIf(Postgres18.socket === null)("Auth", () => {
  layer(NodeServices.layer)((it) => {
    it.layer(server("development"), { buildPerTest: true })((it) => {
      it.effect("opens sign-up in development, and the mailed code signs the device in", () =>
        Effect.gen(function* () {
          const resolver = yield* Ports.SessionResolver;
          const token = yield* signUp("lena@example.org");

          assert.isTrue(Option.isSome(yield* resolver.resolve(bearer(token))));
          assert.isTrue(Option.isNone(yield* resolver.resolve(Headers.empty)));
        }),
      );

      it.effect("tells the resolver when a session ends at sign-out", () =>
        Effect.gen(function* () {
          const resolver = yield* Ports.SessionResolver;
          const token = yield* signUp("lena@example.org");
          const session = yield* resolver.resolve(bearer(token));

          const revoked = yield* Effect.forkChild(Stream.runHead(resolver.revoked), {
            startImmediately: true,
          });

          const signedOut = yield* call("POST", "/sign-out", { body: {}, token });

          assert.strictEqual(signedOut.status, 200);
          assert.deepStrictEqual(
            yield* Fiber.join(revoked),
            Option.map(session, (found) => found.sessionId),
          );
          assert.isTrue(Option.isNone(yield* resolver.resolve(bearer(token))));
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

            assert.notStrictEqual(unverified.status, 200);

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

            assert.notStrictEqual(refused.status, 200);

            const next = yield* call("GET", "/passkey/generate-authenticate-options");

            const signedIn = yield* call("POST", "/passkey/verify-authentication", {
              challenge: next.challenge,
              body: {
                response: yield* authenticator.get(yield* decodeChallenge(next.json), {
                  verified: true,
                }),
              },
            });

            assert.strictEqual(signedIn.status, 200);
            assert.strictEqual(signedIn.cookies, null);

            const { session } = yield* decodePasskeySignedIn(signedIn.json);

            const accountOf = (found: Option.Option<Ports.ResolvedSession>) =>
              Option.map(found, ({ accountId }) => accountId);

            assert.deepStrictEqual(
              accountOf(yield* resolver.resolve(bearer(session.token))),
              accountOf(yield* resolver.resolve(bearer(token))),
            );
          }),
      );
    });

    it.layer(server("beta"), { buildPerTest: true })((it) => {
      it.effect("refuses sign-up outside development and preview", () =>
        Effect.gen(function* () {
          const db = yield* Database.Drizzle;

          const created = yield* call("POST", "/sign-up/email", {
            body: { email: "lena@example.org", password: "lange-genug-123", name: "" },
          });

          assert.strictEqual(created.status, 400);
          assert.deepStrictEqual(yield* decodeRefused(created.json), {
            code: "EMAIL_PASSWORD_SIGN_UP_DISABLED",
          });
          assert.strictEqual(yield* db.$count(MailTables.capturedMail), 0);
        }),
      );
    });
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
