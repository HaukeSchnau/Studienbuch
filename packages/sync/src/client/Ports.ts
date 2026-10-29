/**
 * What the device engine needs from the app on each platform. Besides these it takes Effect's
 * `SqlClient` (one per device database), `HttpClient` and `Socket.WebSocketConstructor`, and
 * `CryptoSuite` from `@stu/e2ee`. The Sync Lab provides one set per virtual device.
 */
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import type * as Stream from "effect/Stream";

export * as Ports from "./Ports.ts";

/** The secrets a device keeps outside its database. */
export const SecretName = Schema.Literals(["root-key", "device-seed"]);

export type SecretName = typeof SecretName.Type;

/** The platform's store refused, such as the iOS keychain before the first unlock after a boot. */
export class SecretsUnavailable extends Schema.TaggedError<
  SecretsUnavailable,
  { readonly brand: unique symbol }
>()("DeviceSecrets.SecretsUnavailable", { secret: SecretName }) {}

/**
 * Named bytes that survive restarts and never leave the device: the keychain on iOS and Android,
 * IndexedDB under a non-extractable key on the web, and memory only on a public computer, so
 * sign-out forgets them.
 */
export class DeviceSecrets extends Context.Service<
  DeviceSecrets,
  {
    /** `None` when the device never stored the secret, which is not a failure. */
    readonly get: (
      name: SecretName,
    ) => Effect.Effect<Option.Option<Uint8Array>, SecretsUnavailable>;
    readonly set: (name: SecretName, value: Uint8Array) => Effect.Effect<void, SecretsUnavailable>;
    readonly remove: (name: SecretName) => Effect.Effect<void, SecretsUnavailable>;
  }
>()("@stu/sync/client/DeviceSecrets") {}

/** The signed-in account that the device database belongs to, and its bearer token. */
export class Session extends Context.Service<
  Session,
  {
    /** Fixed for the database's lifetime: signing in as someone else opens another database. */
    readonly accountId: string;
    /** `None` after sign-out or after the session ended, until the same account signs in again. */
    readonly token: Effect.Effect<Option.Option<Redacted.Redacted>>;
    /** The token now, then each change, so the engine resumes when the account signs in again. */
    readonly changes: Stream.Stream<Option.Option<Redacted.Redacted>>;
    /**
     * The engine calls this when the server says the session is gone: the ticket route answered
     * 401, or the socket closed with `CloseCode.sessionEnded`. Local data and the outbox stay.
     */
    readonly ended: Effect.Effect<void>;
  }
>()("@stu/sync/client/Session") {}

/** Where the server is: `EXPO_PUBLIC_API_URL` on native, the page's own origin on the web. */
export class Server extends Context.Service<Server, { readonly origin: URL }>()(
  "@stu/sync/client/Server",
) {}

export interface LifecycleState {
  /** The app is on screen (native) or its tab is visible (web). */
  readonly foreground: boolean;
  /** The platform reports a network, which is a hint: only a connection proves it. */
  readonly online: boolean;
}

/**
 * The app's state, which the connection supervisor follows: it pulls on foreground, resets its
 * backoff on a network change, and replaces the socket after a long background.
 */
export class Lifecycle extends Context.Service<
  Lifecycle,
  {
    /** The state now, then each change. */
    readonly changes: Stream.Stream<LifecycleState>;
  }
>()("@stu/sync/client/Lifecycle") {}
