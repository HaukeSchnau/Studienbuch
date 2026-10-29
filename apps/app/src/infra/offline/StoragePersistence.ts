import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import { Platform } from "react-native";

// A browser may delete an origin's storage under pressure, the outbox included, unless the origin
// may keep it (client-platform.md, open risk 3). Phones keep an app's files until it is removed.

export * as StoragePersistence from "./StoragePersistence.ts";

/** Whether this device keeps its data, or a browser may delete it. */
export type State = "kept" | "may be deleted";

const ask = () =>
  "storage" in navigator && "persist" in navigator.storage
    ? navigator.storage.persist()
    : Promise.resolve(false);

/**
 * The browser's answer when the app asks to keep its data. Reading it asks: Chrome and Safari
 * decide by how the site is used, and Firefox asks the person once.
 */
export const state = Atom.make(
  Platform.OS === "web"
    ? Effect.map(Effect.promise(ask), (kept): State => (kept ? "kept" : "may be deleted"))
    : Effect.succeed<State>("kept"),
).pipe(Atom.keepAlive);
