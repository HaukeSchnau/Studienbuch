import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import { Platform } from "react-native";

import { keepsDatabases } from "../sqlite/database.ts";

// A browser may delete an origin's storage under pressure, the outbox included, unless the origin
// may keep it (client-platform.md, open risk 3). Phones keep an app's files until it is removed.

export * as StoragePersistence from "./StoragePersistence.ts";

/**
 * Whether this device keeps its data, a browser may delete it, or it lives in memory only: on a
 * public computer, or in a private window, which offers no OPFS.
 */
export type State = "kept" | "may be deleted" | "memory only";

const ask = () =>
  "storage" in navigator && "persist" in navigator.storage
    ? navigator.storage.persist()
    : Promise.resolve(false);

/**
 * The browser's answer when the app asks to keep its data. Reading it asks: Chrome and Safari
 * decide by how the site is used, and Firefox asks the person once. Memory keeps nothing to ask
 * about.
 */
export const current = (publicComputer: boolean) =>
  Effect.flatMap(keepsDatabases, (kept): Effect.Effect<State> => {
    if (publicComputer || !kept) return Effect.succeed("memory only");

    return Platform.OS === "web"
      ? Effect.map(Effect.promise(ask), (persisted): State =>
          persisted ? "kept" : "may be deleted",
        )
      : Effect.succeed("kept");
  });

/** `current` for screens, asked once. */
export const state = Atom.family((publicComputer: boolean) =>
  Atom.make(current(publicComputer)).pipe(Atom.keepAlive),
);
