import type * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import type * as SqlClient from "effect/sql/SqlClient";
import type * as SqlError from "effect/sql/SqlError";

import type { TabOwner } from "../device/TabOwner.ts";
import type { Keychain } from "../keychain/Keychain.ts";

// The databases a device keeps, whichever SQLite build holds them (ADR 0013). `database.ts` opens
// and deletes them on iOS and Android, `database.web.ts` in a browser.

export * as Databases from "./Databases.ts";

/** Where one database of a device lives. */
export interface Location {
  /** `Device.Options.name`. In a browser, each device has its own OPFS directory and owner lock. */
  readonly device: string;
  /** `Names.database` for an account's database, or a fixed name such as `diagnostics`. */
  readonly name: string;
  /** Kept in memory only, so it is gone once its scope closes. */
  readonly memory: boolean;
}

/** Opens a database as `SqlClient` for the layer's lifetime. */
export type Open = (
  location: Location,
) => Layer.Layer<
  SqlClient.SqlClient,
  SqlError.SqlError | Keychain.Unavailable | TabOwner.InUse,
  Keychain.Store
>;

/** The platform refused to delete a database's files. */
export class RemoveFailed extends Schema.TaggedError<
  RemoveFailed,
  { readonly brand: unique symbol }
>()("Databases.RemoveFailed", { cause: Schema.Defect() }) {}

/**
 * Deletes a database and its key. Close it first: an open database can't be deleted. Deleting one
 * that doesn't exist succeeds.
 */
export type Remove = (
  location: Location,
) => Effect.Effect<void, RemoveFailed | Keychain.Unavailable, Keychain.Store>;
