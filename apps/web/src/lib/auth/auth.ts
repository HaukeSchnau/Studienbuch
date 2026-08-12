import { expo } from "@better-auth/expo";
import { Database } from "@stu/server";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { applicationRuntime } from "#/server-runtime/lifecycle.server.ts";

const createAuth = async () => {
  const database = await applicationRuntime.runPromise(Database.Service);

  return betterAuth({
    database: database.pool,
    advanced: {
      database: {
        generateId: false,
      },
    },
    user: { modelName: "users" },
    session: { modelName: "sessions" },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins: ["studienbuch://", "studienbuch://*"],
    plugins: [expo(), tanstackStartCookies()],
  });
};

let auth: ReturnType<typeof createAuth> | undefined;

export const getAuth = () => (auth ??= createAuth());
