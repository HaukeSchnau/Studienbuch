/**
 * The `Demo` RPC group: signing in as one of the demo school's students without a password, which
 * development servers and previews offer as "sign in as". Every server has the handler, and beta
 * and production refuse, where the review account signs in with its password instead.
 */
import { Demo } from "@stu/api/Demo";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Auth } from "../auth/Auth.ts";
import { Deployment } from "../infra/config/Deployment.ts";
import { DemoAccounts } from "./DemoAccounts.ts";

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

        // Both checks above hold, so `signInDemo` agrees.
        const token = yield* Effect.orDie(auth.signInDemo(account.value));

        return new Demo.Session({ account: account.value, token });
      }),
    });
  }),
);
