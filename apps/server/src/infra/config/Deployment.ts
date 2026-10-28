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

export * as Deployment from "./Deployment.ts";
