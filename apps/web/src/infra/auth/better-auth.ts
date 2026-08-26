import { Auth } from "@stu/server";
import { applicationRuntime } from "#/infra/runtime/lifecycle.server.ts";

/** The process-wide Better Auth instance, built once as part of the application runtime. */
export const getAuth = () => applicationRuntime.runPromise(Auth.Service);
