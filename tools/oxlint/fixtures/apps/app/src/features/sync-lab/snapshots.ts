import { SyncClient } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Reactivity from "effect/reactivity/Reactivity";

// The Sync Lab shows every table and the engine's own state, so it follows every key.
export const snapshots = Reactivity.stream(Effect.succeed([]), Object.values(SyncClient.keys));
