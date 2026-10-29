import { Accounts } from "@stu/api/Accounts";
import { Ports } from "@stu/sync/client";
import type * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import type * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as HttpIncomingMessage from "effect/http/HttpIncomingMessage";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

// Better Auth's routes at `Accounts.path`, the ones Studienbuch uses, with every response parsed.
// A device sends its bearer token and keeps no cookies (ADR 0028).

export * as AuthApi from "./AuthApi.ts";

/** Better Auth turned the request down. `code` is its error code, such as `INVALID_OTP`. */
export class Refused extends Schema.TaggedError<Refused, { readonly brand: unique symbol }>()(
  "AuthApi.Refused",
  { status: Schema.Int, code: Schema.String },
) {}

/** No answer at all: the device is offline, or the server is down. */
export class Unreachable extends Schema.TaggedError<
  Unreachable,
  { readonly brand: unique symbol }
>()("AuthApi.Unreachable", { cause: Schema.Defect() }) {}

/** The server answered with an error of its own, or with something that isn't Better Auth's. */
export class ServerFailed extends Schema.TaggedError<
  ServerFailed,
  { readonly brand: unique symbol }
>()("AuthApi.ServerFailed", { cause: Schema.Defect() }) {}

type Failure = Refused | Unreachable | ServerFailed;

/** A signed-in device: the account and the bearer token of its new session. */
export interface SignedIn {
  readonly accountId: string;
  readonly token: Redacted.Redacted;
}

/** WebAuthn options as the server sent them, with the challenge that goes back with the answer. */
export interface Ceremony<Options> {
  readonly options: Options;
  readonly challenge: string;
}

/** An authenticator's answer as JSON, which the server checks. It carries no extension results. */
export interface Credential {
  readonly id: string;
  readonly rawId: string;
  readonly type: string;
  readonly authenticatorAttachment?: string | undefined;
  readonly response: Readonly<Record<string, string | number | ReadonlyArray<string> | undefined>>;
  readonly clientExtensionResults: Readonly<Record<string, never>>;
}

const Descriptor = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("public-key"),
  transports: Schema.optional(Schema.Array(Schema.String)),
});

const Requirement = Schema.Literals(["discouraged", "preferred", "required"]);

/** Options for `navigator.credentials.create`, as JSON. */
export const CreationOptions = Schema.Struct({
  challenge: Schema.String,
  rp: Schema.Struct({ id: Schema.optional(Schema.String), name: Schema.String }),
  user: Schema.Struct({ id: Schema.String, name: Schema.String, displayName: Schema.String }),
  pubKeyCredParams: Schema.Array(
    Schema.Struct({ type: Schema.Literal("public-key"), alg: Schema.Int }),
  ),
  timeout: Schema.optional(Schema.Int),
  excludeCredentials: Schema.optional(Schema.Array(Descriptor)),
  authenticatorSelection: Schema.optional(
    Schema.Struct({
      authenticatorAttachment: Schema.optional(Schema.Literals(["platform", "cross-platform"])),
      residentKey: Schema.optional(Requirement),
      requireResidentKey: Schema.optional(Schema.Boolean),
      userVerification: Schema.optional(Requirement),
    }),
  ),
  attestation: Schema.optional(Schema.Literals(["none", "indirect", "direct", "enterprise"])),
});

export type CreationOptions = typeof CreationOptions.Type;

/** Options for `navigator.credentials.get`, as JSON. */
export const RequestOptions = Schema.Struct({
  challenge: Schema.String,
  rpId: Schema.optional(Schema.String),
  timeout: Schema.optional(Schema.Int),
  allowCredentials: Schema.optional(Schema.Array(Descriptor)),
  userVerification: Schema.optional(Requirement),
});

export type RequestOptions = typeof RequestOptions.Type;

const User = Schema.Struct({ id: Schema.String });

type Body = Readonly<Record<string, string | Credential>>;

type Read<A> = (
  response: HttpClientResponse.HttpClientResponse,
) => Effect.Effect<
  A,
  Schema.SchemaError | HttpClientError.HttpClientError | Cause.NoSuchElementError
>;

// Every sign-in answers with the account in its body and the session's signed token in
// `set-auth-token`. The server accepts only the signed form (ADR 0028).
const userOf = HttpIncomingMessage.schemaBodyJson(Schema.Struct({ user: User }));

const signedIn: Read<SignedIn> = (response) =>
  Effect.all({
    user: Effect.map(userOf(response), (body) => body.user),
    token: Effect.fromOption(Headers.get(response.headers, "set-auth-token")),
  }).pipe(Effect.map(({ user, token }) => ({ accountId: user.id, token: Redacted.make(token) })));

const sessionExpiry = HttpIncomingMessage.schemaBodyJson(
  Schema.NullOr(Schema.Struct({ session: Schema.Struct({ expiresAt: Schema.String }) })),
);

const refusal = HttpIncomingMessage.schemaBodyJson(Schema.Struct({ code: Schema.String }));
const creationOptions = HttpIncomingMessage.schemaBodyJson(CreationOptions);
const requestOptions = HttpIncomingMessage.schemaBodyJson(RequestOptions);

export class Service extends Context.Service<
  Service,
  {
    /** Creates an account. Better Auth mails a code, and answers the same for a known address. */
    readonly signUp: (email: string, password: string) => Effect.Effect<void, Failure>;
    /** `EMAIL_NOT_VERIFIED` means the address still needs its code, which is on its way. */
    readonly signIn: (email: string, password: string) => Effect.Effect<SignedIn, Failure>;
    readonly sendCode: (email: string) => Effect.Effect<void, Failure>;
    readonly confirmEmail: (email: string, code: string) => Effect.Effect<SignedIn, Failure>;
    /** When the session ends now, or `None` once it ended. A call also renews it (D27). */
    readonly session: (token: Redacted.Redacted) => Effect.Effect<Option.Option<Date>, Failure>;
    readonly signOut: (token: Redacted.Redacted) => Effect.Effect<void, Failure>;
    readonly passkeySignInOptions: Effect.Effect<Ceremony<RequestOptions>, Failure>;
    readonly passkeySignIn: (
      challenge: string,
      credential: Credential,
    ) => Effect.Effect<SignedIn, Failure>;
    readonly passkeyCreationOptions: (
      token: Redacted.Redacted,
    ) => Effect.Effect<Ceremony<CreationOptions>, Failure>;
    readonly addPasskey: (
      token: Redacted.Redacted,
      challenge: string,
      credential: Credential,
    ) => Effect.Effect<void, Failure>;
  }
>()("AuthApi.Service") {}

// A 4xx answer carries Better Auth's error code. Anything else wrong is the server's problem.
const checked = (
  response: HttpClientResponse.HttpClientResponse,
): Effect.Effect<HttpClientResponse.HttpClientResponse, Refused | ServerFailed> => {
  if (response.status < 400) return Effect.succeed(response);

  if (response.status >= 500) {
    return Effect.fail(new ServerFailed({ cause: `HTTP ${response.status}` }));
  }

  return refusal(response).pipe(
    Effect.map(({ code }) => code),
    Effect.orElseSucceed(() => (response.status === 429 ? "RATE_LIMITED" : "UNKNOWN")),
    Effect.flatMap((code) => Effect.fail(new Refused({ status: response.status, code }))),
  );
};

const post = (path: string, body: Body) =>
  HttpClientRequest.bodyJsonUnsafe(HttpClientRequest.post(path), body);

/** Better Auth on the device's server, over the device's HTTP client. */
export const layer = Layer.effect(Service)(
  Effect.gen(function* () {
    const server = yield* Ports.Server;

    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(
        HttpClientRequest.prependUrl(`${server.origin.origin}${Accounts.path}`),
      ),
    );

    const send = (request: HttpClientRequest.HttpClientRequest) =>
      client.execute(request).pipe(
        Effect.mapError((cause) => new Unreachable({ cause })),
        Effect.flatMap(checked),
      );

    const read = <A>(request: HttpClientRequest.HttpClientRequest, body: Read<A>) =>
      Effect.flatMap(send(request), (response) =>
        Effect.mapError(body(response), (cause) => new ServerFailed({ cause })),
      );

    const ceremony = <A>(request: HttpClientRequest.HttpClientRequest, body: Read<A>) =>
      Effect.flatMap(send(request), (response) =>
        Effect.all({
          options: body(response),
          challenge: Effect.fromOption(Headers.get(response.headers, Accounts.challengeHeader)),
        }).pipe(Effect.mapError((cause) => new ServerFailed({ cause }))),
      );

    const withChallenge = (request: HttpClientRequest.HttpClientRequest, challenge: string) =>
      HttpClientRequest.setHeader(request, Accounts.challengeHeader, challenge);

    return {
      signUp: (email, password) =>
        Effect.asVoid(send(post("/sign-up/email", { email, password, name: "" }))),
      signIn: (email, password) => read(post("/sign-in/email", { email, password }), signedIn),
      sendCode: (email) => Effect.asVoid(send(post("/send-verification-email", { email }))),
      confirmEmail: (email, code) =>
        read(post("/email-otp/verify-email", { email, otp: code }), signedIn),
      session: (token) =>
        Effect.map(
          read(
            HttpClientRequest.bearerToken(HttpClientRequest.get("/get-session"), token),
            sessionExpiry,
          ),
          (found) =>
            Option.map(Option.fromNullishOr(found), ({ session }) => new Date(session.expiresAt)),
        ),
      signOut: (token) =>
        Effect.asVoid(send(HttpClientRequest.bearerToken(post("/sign-out", {}), token))),
      passkeySignInOptions: ceremony(
        HttpClientRequest.get("/passkey/generate-authenticate-options"),
        requestOptions,
      ),
      passkeySignIn: (challenge, credential) =>
        read(
          withChallenge(
            post("/passkey/verify-authentication", { response: credential }),
            challenge,
          ),
          signedIn,
        ),
      passkeyCreationOptions: (token) =>
        ceremony(
          HttpClientRequest.bearerToken(
            HttpClientRequest.get("/passkey/generate-register-options"),
            token,
          ),
          creationOptions,
        ),
      addPasskey: (token, challenge, credential) =>
        Effect.asVoid(
          send(
            HttpClientRequest.bearerToken(
              withChallenge(
                post("/passkey/verify-registration", { response: credential }),
                challenge,
              ),
              token,
            ),
          ),
        ),
    };
  }),
);
