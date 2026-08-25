import { expo } from "@better-auth/expo";
import { Auth } from "@stu/server";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { AuthEmail } from "#/infra/email/auth-email.server.ts";
import { applicationRuntime } from "#/infra/runtime/lifecycle.server.ts";

/** Plugins and delivery adapters the web application contributes to shared authentication. */
export const authOptions = Effect.gen(function* () {
  const email = yield* AuthEmail;
  const passkeyRpID = yield* Config.string("STUDIENBUCH_PASSKEY_RP_ID").pipe(Config.option);
  return {
    emailVerification: {
      sendVerificationEmail: email.sendVerificationEmail,
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
    },
    sendResetPassword: email.sendPasswordResetEmail,
    passkeyRpID: Option.getOrUndefined(passkeyRpID),
    plugins: [expo(), tanstackStartCookies()],
    trustedOrigins: ["studienbuch://", "studienbuch://*"],
  } satisfies Auth.Options;
});

/** The process-wide Better Auth instance, built once as part of the application runtime. */
export const getAuth = () => applicationRuntime.runPromise(Auth.Service);
