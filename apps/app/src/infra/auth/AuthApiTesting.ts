import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { AuthApi } from "./AuthApi.ts";

// An `AuthApi` for tests: each test names the calls it expects, and any other call is a defect.

export * as AuthApiTesting from "./AuthApiTesting.ts";

const unexpected = (call: string) => () => Effect.die(`AuthApi.${call} was not expected`);

export const layer = (calls: Partial<AuthApi.Service["Service"]>) =>
  Layer.succeed(AuthApi.Service)({
    signUp: unexpected("signUp"),
    signIn: unexpected("signIn"),
    sendCode: unexpected("sendCode"),
    confirmEmail: unexpected("confirmEmail"),
    session: unexpected("session"),
    signOut: unexpected("signOut"),
    passkeySignInOptions: Effect.die("AuthApi.passkeySignInOptions was not expected"),
    passkeySignIn: unexpected("passkeySignIn"),
    passkeyCreationOptions: unexpected("passkeyCreationOptions"),
    addPasskey: unexpected("addPasskey"),
    ...calls,
  });
