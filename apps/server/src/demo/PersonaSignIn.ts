/**
 * The `Demo` RPC group. Development servers and previews sign anyone in as one of the demo school's
 * students without a password, and hand over the student's root key with the session. Every server
 * gives a signed-in demo account its own root key, which beta's store review account needs after
 * signing in with its password.
 */
import { Demo } from "@stu/api/Demo";
import { CryptoSuite } from "@stu/e2ee";
import * as Effect from "effect/Effect";
import type * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { Auth } from "../auth/Auth.ts";
import { Deployment } from "../infra/config/Deployment.ts";
import { DemoAccounts } from "./DemoAccounts.ts";
import { DemoKeys } from "./DemoKeys.ts";

export * as PersonaSignIn from "./PersonaSignIn.ts";

export const handlers = Demo.Rpcs.toLayer(
  Effect.gen(function* () {
    const { environment } = yield* Deployment.Current;
    const auth = yield* Auth.Service;

    return Demo.Rpcs.of({
      "Demo.signIn": Effect.fn("PersonaSignIn.signIn")(function* ({ persona }) {
        if (!Deployment.isDevelopmentOrPreview(environment)) return yield* new Demo.Unavailable();

        const account = yield* Effect.orDie(DemoAccounts.accountOf(persona));

        if (Option.isNone(account)) return yield* new Demo.NotSeeded({ persona });

        // Both checks above hold, so `rootKey` and `signInDemo` agree. The key comes first, so a
        // server without its seed fails before it creates a session.
        const rootKey = yield* Effect.orDie(DemoKeys.rootKey(account.value));
        const token = yield* Effect.orDie(auth.signInDemo(account.value));

        return new Demo.Session({
          account: account.value,
          token,
          rootKey: Redacted.value(rootKey),
        });
      }),

      "Demo.rootKey": Effect.fn("PersonaSignIn.rootKey")(function* (
        _: void,
        { headers }: { readonly headers: Headers.Headers },
      ) {
        const session = yield* auth.sessions.resolve(headers);

        if (Option.isNone(session)) return yield* new Demo.SignedOut();

        const rootKey = yield* DemoKeys.rootKey(session.value.accountId).pipe(
          Effect.catchTags({
            "DemoKeys.NotDemo": () => Effect.fail(new Demo.NotDemo()),
            // The server's own secret is missing or too short, which `prepare` already refused.
            ConfigError: Effect.die,
          }),
        );

        return new Demo.RootKey({ rootKey: Redacted.value(rootKey) });
      }),
    });
  }),
).pipe(Layer.provide(CryptoSuite.layer));
