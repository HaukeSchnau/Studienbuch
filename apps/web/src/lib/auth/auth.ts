import { expo } from "@better-auth/expo";
import { Auth } from "@stu/server";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { mobileTrustedOrigins } from "#/project.ts";
import { applicationRuntime } from "#/server-runtime/lifecycle.server.ts";

/**
 * Plugins the web application contributes to the shared Better Auth configuration.
 *
 * `tanstackStartCookies` teaches Better Auth how to set cookies through this framework, and `expo`
 * admits the mobile client's custom scheme. Both are app concerns, so they live here rather than in
 * `@stu/server`, which owns only what has to agree with the database schema.
 */
export const authOptions: Auth.Options = {
  plugins: [expo(), tanstackStartCookies()],
  trustedOrigins: [...mobileTrustedOrigins],
};

/** The process-wide Better Auth instance, built once as part of the application runtime. */
export const getAuth = () => applicationRuntime.runPromise(Auth.Service);
