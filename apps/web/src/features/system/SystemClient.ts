import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";

// The web's access to the `System` RPC group. Until `packages/api` lands (M0-WP-10), `info` fails
// with `Unreachable`; then it becomes the RPC call and `Info` the group's success schema.
export * as SystemClient from "./SystemClient.ts";

export interface Info {
  readonly revision: string;
  readonly environment: string;
  readonly serverTime: DateTime.Utc;
}

export class Unreachable extends Schema.TaggedError<Unreachable>()(
  "SystemClient.Unreachable",
  {},
) {}

const fetchInfo: Effect.Effect<Info, Unreachable> = Effect.fail(new Unreachable());

/** What `System.info` returns. Prerendering never calls the server, so the HTML shows the waiting state. */
export const info = Atom.make(fetchInfo).pipe(Atom.withServerValueInitial);
