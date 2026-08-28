import { Auth } from "@stu/server";
import { currentApplicationRuntime } from "#/infra/runtime/lifecycle.server.ts";

/** The current generation's Better Auth instance, shared as part of the application runtime. */
export const getAuth = () => currentApplicationRuntime().runPromise(Auth.Service);
