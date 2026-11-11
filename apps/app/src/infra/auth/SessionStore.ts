import { Ports } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { DeviceSessions } from "../keychain/DeviceSessions.ts";
import type { Keychain } from "../keychain/Keychain.ts";
import { AuthApi } from "./AuthApi.ts";

// Which account this device is signed in as. The token sits in `DeviceSessions`, so the app knows
// at start which database to open without asking the network. A device holds one account at a
// time: `Account.keep` refuses a second. A public computer's session stays in this run's memory.

export * as SessionStore from "./SessionStore.ts";

/**
 * The signed-in account. `token` is `None` once the server ended the session: the account and its
 * data stay on the device until it signs in again or signs out.
 */
export interface Signed {
  readonly accountId: string;
  readonly token: Option.Option<Redacted.Redacted>;
  /** Signed in with a password at a demo account's address, as a persona (`Demo.isDemoSignIn`). */
  readonly demo: boolean;
  /** `Device.PublicComputer` for the account, fixed while the device holds it. */
  readonly publicComputer: boolean;
}

export class Service extends Context.Service<
  Service,
  {
    readonly current: Effect.Effect<Option.Option<Signed>>;
    /** The account now, then each change. */
    readonly changes: Stream.Stream<Option.Option<Signed>>;
    /**
     * Keeps a new session, in memory only when `publicComputer`. An account the device holds
     * already stays where it is.
     */
    readonly signedIn: (
      session: DeviceSessions.Session,
      publicComputer: boolean,
    ) => Effect.Effect<void, Keychain.Unavailable>;
    /**
     * The server ended the session. The device stops using the token until the account signs in
     * again. The stored token stays, so after a restart the server says so once more.
     */
    readonly ended: Effect.Effect<void>;
    /** Forgets the account, at sign-out. */
    readonly forget: Effect.Effect<void, Keychain.Unavailable>;
  }
>()("SessionStore.Service") {}

export const layer = Layer.effect(Service)(
  Effect.gen(function* () {
    const sessions = yield* DeviceSessions.Service;

    const stored = Option.map(
      Option.fromIterable(yield* sessions.all),
      ({ accountId, token, demo }): Signed => ({
        accountId,
        token: Option.some(token),
        demo,
        publicComputer: false,
      }),
    );

    const ref = yield* SubscriptionRef.make(stored);

    return {
      current: SubscriptionRef.get(ref),
      changes: SubscriptionRef.changes(ref),
      signedIn: Effect.fn("SessionStore.signedIn")(function* (
        { accountId, token, demo }: DeviceSessions.Session,
        chosen: boolean,
      ) {
        const held = Option.filter(
          yield* SubscriptionRef.get(ref),
          (signed) => signed.accountId === accountId,
        );

        const publicComputer = Option.match(held, {
          onNone: () => chosen,
          onSome: (signed) => signed.publicComputer,
        });

        if (!publicComputer) yield* sessions.set({ accountId, token, demo });

        yield* SubscriptionRef.set(
          ref,
          Option.some({ accountId, token: Option.some(token), demo, publicComputer }),
        );
      }),
      ended: SubscriptionRef.update(
        ref,
        Option.map((signed) => ({ ...signed, token: Option.none() })),
      ),
      forget: Effect.flatMap(SubscriptionRef.get(ref), (current) =>
        Option.match(current, {
          onNone: () => Effect.void,
          onSome: ({ accountId, publicComputer }) =>
            (publicComputer ? Effect.void : sessions.remove(accountId)).pipe(
              Effect.andThen(SubscriptionRef.set(ref, Option.none())),
            ),
        }),
      ),
    };
  }),
);

const tokenOf =
  (accountId: string) =>
  (current: Option.Option<Signed>): Option.Option<Redacted.Redacted> =>
    current.pipe(
      Option.filter((signed) => signed.accountId === accountId),
      Option.flatMap((signed) => signed.token),
    );

const sameToken = (a: Option.Option<Redacted.Redacted>, b: Option.Option<Redacted.Redacted>) =>
  Equal.equals(Option.map(a, Redacted.value), Option.map(b, Redacted.value));

/**
 * The engine's `Session` for one account. On every return to the foreground the device asks the
 * server for its session, which renews it (D27) and notices one that ended while the app was away.
 */
export const session = (accountId: string) =>
  Layer.effect(Ports.Session)(
    Effect.gen(function* () {
      const store = yield* Service;
      const api = yield* AuthApi.Service;
      const lifecycle = yield* Ports.Lifecycle;
      const token = Effect.map(store.current, tokenOf(accountId));

      yield* lifecycle.changes.pipe(
        Stream.filter((state) => state.foreground && state.online),
        Stream.runForEach(() =>
          Effect.flatMap(token, (current) =>
            Option.match(current, {
              onNone: () => Effect.void,
              onSome: (bearer) =>
                api.session(bearer).pipe(
                  Effect.flatMap(
                    Option.match({ onNone: () => store.ended, onSome: () => Effect.void }),
                  ),
                  // Offline or a server hiccup proves nothing about the session.
                  Effect.catchTags({
                    "AuthApi.Unreachable": () => Effect.void,
                    "AuthApi.ServerFailed": () => Effect.void,
                    "AuthApi.Refused": () => Effect.void,
                  }),
                ),
            }),
          ),
        ),
        Effect.forkScoped,
      );

      return {
        accountId,
        token,
        changes: store.changes.pipe(Stream.map(tokenOf(accountId)), Stream.changesWith(sameToken)),
        ended: store.ended,
      };
    }),
  );
