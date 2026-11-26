/**
 * The import's connection to WebUntis (m2-import-path.md, section 2), built for one run. Its
 * account is the one live tests and captures use, and two logins with it log each other out
 * (AGENTS.md rule 2). So the run's gate admits every request before it is sent, a run logs in once,
 * and nothing is sent after WebUntis said the session is gone.
 */
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import { Credential, type WebUntisConnection, webUntisLayer } from "@schnau/webuntis-api";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

export * as LiveWebUntis from "./LiveWebUntis.ts";

const settings = {
  loginName: Config.option(Config.String("WEBUNTIS_SCHOOL_LOGIN_NAME")),
  serverUrl: Config.option(Config.String("WEBUNTIS_SERVER_URL")),
  username: Config.option(Config.String("WEBUNTIS_USERNAME")),
  password: Config.option(Config.Redacted("WEBUNTIS_PASSWORD")),
};

/**
 * The school and the account from `WEBUNTIS_*` or their `_FILE` forms, and none when none is set.
 * Some set and others not is an error, not an absence. The school is named by its login name and
 * server, because looking it up would be a request outside the login.
 */
export const credentials: Config.Config<Option.Option<WebUntisConnection>> = Config.all({
  ...settings,
  tenantId: Config.option(Config.String("WEBUNTIS_TENANT_ID")),
}).pipe(
  Config.flatMap(({ loginName, serverUrl, username, password, tenantId }) => {
    const set = {
      WEBUNTIS_SCHOOL_LOGIN_NAME: Option.isSome(loginName),
      WEBUNTIS_SERVER_URL: Option.isSome(serverUrl),
      WEBUNTIS_USERNAME: Option.isSome(username),
      WEBUNTIS_PASSWORD: Option.isSome(password),
    };

    const missing = Object.entries(set).flatMap(([name, isSet]) => (isSet ? [] : [name]));

    if (missing.length === Object.keys(set).length) return Config.succeed(Option.none());

    if (
      Option.isNone(loginName) ||
      Option.isNone(serverUrl) ||
      Option.isNone(username) ||
      Option.isNone(password)
    ) {
      return Config.fail(
        new ConfigProvider.SourceError({
          message: `The WebUntis credentials are incomplete: ${missing.join(", ")} missing`,
        }),
      );
    }

    return Config.succeed(
      Option.some<WebUntisConnection>({
        school: {
          loginName: loginName.value,
          serverUrl: serverUrl.value,
          tenantId: Option.getOrUndefined(tenantId),
        },
        credential: Credential.Password({ username: username.value, password: password.value }),
      }),
    );
  }),
);

/** What the run decides about each request before it is sent. */
export interface Gate<E> {
  /** Admits the next request, or fails, and the request stays unsent. */
  readonly admit: Effect.Effect<void, E>;
  /** The session is gone. The gate admits nothing after it. */
  readonly lose: Effect.Effect<void>;
}

/** How long a request may wait for its answer's headers before it counts as failed. */
export const answerWithin = Duration.seconds(30);

/**
 * webuntis-api's limits for the connection. The run's reservation is the hard cap; these only keep
 * one run from hurrying.
 */
const limits = { concurrency: 2, budget: { requests: 120, window: "1 minute" } } as const;

// webuntis-api posts the account's password here, once per login.
const isLoginForm = (request: HttpClientRequest.HttpClientRequest) =>
  request.method === "POST" &&
  (URL.parse(request.url)?.pathname ?? "").endsWith("/j_spring_security_check");

const failed = (
  request: HttpClientRequest.HttpClientRequest,
  description: string,
  cause?: unknown,
) =>
  new HttpClientError.HttpClientError({
    reason: new HttpClientError.TransportError({ request, description, cause }),
  });

/**
 * The client webuntis-api sends through: `gate` admits each attempt, retries and logins included,
 * and a second login form or a 401 loses the session. A refused attempt fails as a transport error that
 * was never sent, so webuntis-api's retries of it are refused too.
 */
export const gated = Effect.fn("LiveWebUntis.gated")(function* <E>(
  client: HttpClient.HttpClient,
  gate: Gate<E>,
) {
  const loggedIn = yield* Ref.make(false);

  return HttpClient.transform(client, (send, request) =>
    Effect.gen(function* () {
      const login = isLoginForm(request);

      // A token renewal or a retried form would be a second login, which logs out whoever took
      // the account since, so the run ends instead.
      if (login && (yield* Ref.get(loggedIn))) {
        yield* gate.lose;

        return yield* failed(request, "not sent: a second login");
      }

      yield* gate.admit.pipe(
        Effect.mapError((cause) =>
          failed(request, "not sent: the import's gate refused it", cause),
        ),
      );

      if (login) yield* Ref.set(loggedIn, true);

      const response = yield* send.pipe(
        Effect.timeoutOrElse({
          duration: answerWithin,
          orElse: () => Effect.fail(failed(request, "no answer in time")),
        }),
      );

      // Only 401 means the session is gone. Logging in again would log out whoever took it.
      if (response.status === 401) yield* gate.lose;

      return response;
    }),
  );
});

/** One run's webuntis-api over the context's client, every request through `gate`. */
export const layer = <E>(connection: WebUntisConnection, gate: Gate<E>) =>
  webUntisLayer({ ...connection, limits }).pipe(
    Layer.provide(
      Layer.effect(HttpClient.HttpClient)(
        Effect.flatMap(HttpClient.HttpClient, (client) => gated(client, gate)),
      ),
    ),
  );

/**
 * A client that sends each request exactly once. Fetch sends a request again when WebUntis answers
 * 421, also a form, so one admission could log in twice; node:http follows nothing and retries
 * nothing. Its agents live as long as the run's layer.
 */
export const transport = NodeHttpClient.layerNodeHttp;
