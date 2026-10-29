import { System } from "@stu/api/System";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/** Which release runs, and where. Readiness, `System.info` and telemetry report it. */
export class Current extends Context.Service<
  Current,
  { readonly revision: string; readonly environment: System.Environment }
>()("Deployment.Current") {}

export const layer = Layer.effect(Current)(
  Effect.map(
    Config.all({
      // The deploy passes the git revision, so the bundle stays keyed by its tree.
      revision: Config.String("STUDIENBUCH_REVISION").pipe(Config.withDefault("unreleased")),
      environment: Config.schema(System.Environment, "STUDIENBUCH_ENVIRONMENT"),
    }),
    Current.of,
  ),
);

/**
 * Development and preview servers hold no real students. They open sign-up, keep mail instead of
 * sending it, and show the Sync Lab what they hold.
 */
export const isDevelopmentOrPreview = (environment: System.Environment) =>
  environment === "development" || environment === "preview";

export * as Deployment from "./Deployment.ts";
