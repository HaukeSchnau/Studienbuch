/** The definition the server engine runs, checked once when its layer builds. */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import { Sync } from "../definition/Sync.ts";

export * as SyncSchema from "./SyncSchema.ts";

export class Service extends Context.Service<Service, Sync.Definition>()(
  "@stu/sync/server/SyncSchema",
) {}

/** Dies on the first rule the definition breaks, so a broken build never serves. */
export const layer = (definition: Sync.Definition) =>
  Layer.effect(
    Service,
    Result.match(Sync.validate(definition), {
      onSuccess: Effect.succeed,
      onFailure: Effect.die,
    }),
  );

/** The kind a stored space names. A name the definition lacks is a defect. */
export const kindOf = (definition: Sync.Definition, name: string) => {
  const kind = definition.byName.spaceKinds.get(name);

  return kind === undefined
    ? Effect.die(`The space kind ${name} isn't declared`)
    : Effect.succeed(kind);
};
