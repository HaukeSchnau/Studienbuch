import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Schema from "effect/Schema";

/**
 * Which kind of deployment a server is. It turns on development features such as persona sign-in
 * and captured mail, and nothing else may depend on it (ADR 0004).
 */
export const Environment = Schema.Literals(["development", "preview", "beta", "production"]);

export type Environment = typeof Environment.Type;

/**
 * Development and preview servers hold no real students. They open sign-up, keep mail instead of
 * sending it, sign anyone in as a demo persona, and show the Sync Lab what they hold. The app
 * offers persona sign-in and the Sync Lab by the same rule, from `Info.environment`.
 */
export const isDevelopmentOrPreview = (environment: Environment) =>
  environment === "development" || environment === "preview";

/**
 * What a client shows about the server it talks to. `revision` is the git revision of the release,
 * or `"unreleased"` when the server runs from a working copy.
 */
export class Info extends Schema.Class<Info, { readonly brand: unique symbol }>("System.Info")({
  revision: Schema.String,
  environment: Environment,
  serverTime: Schema.DateTimeUtc,
}) {}

export const Rpcs = RpcGroup.make(Rpc.make("System.info", { success: Info }));

export * as System from "./System.ts";
