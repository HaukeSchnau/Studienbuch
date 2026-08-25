import { expo } from "@better-auth/expo";
import { Auth } from "@stu/server";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { applicationRuntime } from "#/infra/runtime/lifecycle.server.ts";
import { sendPasswordResetEmail, sendVerificationEmail } from "#/infra/email/auth-email.server.ts";

/**
 * Plugins the web application contributes to the shared Better Auth configuration.
 *
 * `tanstackStartCookies` teaches Better Auth how to set cookies through this framework, and `expo`
 * admits the mobile client's custom scheme. Both are app concerns, so they live here rather than in
 * `@stu/server`, which owns only what has to agree with the database schema.
 */
export const authOptions: Auth.Options = {
  emailVerification: {
    sendVerificationEmail,
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
  },
  sendResetPassword: sendPasswordResetEmail,
  plugins: [expo(), tanstackStartCookies()],
  trustedOrigins: ["studienbuch://", "studienbuch://*"],
};

/** The process-wide Better Auth instance, built once as part of the application runtime. */
export const getAuth = () => applicationRuntime.runPromise(Auth.Service);
