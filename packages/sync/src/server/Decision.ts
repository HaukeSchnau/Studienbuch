/**
 * What the server decides about one pushed command inside its transaction, and the space locks
 * both command kinds take first. Only `Applied` commits. A refusal is recorded in a second
 * transaction, and `Retry` and `Stale` leave no trace.
 */
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type { Sync } from "../definition/Sync.ts";
import type { Protocol } from "../protocol/Protocol.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { SyncSchema } from "./SyncSchema.ts";

export * as Decision from "./Decision.ts";

export type Decision = Data.TaggedEnum<{
  Applied: {
    /** The spaces the command advanced, at their new versions. */
    readonly spaces: ReadonlyArray<typeof Protocol.Cursor.Type>;
    /** Accounts whose memberships the command changed. */
    readonly accounts: ReadonlyArray<string>;
  };
  Refused: { readonly reason: Refusal.Reason };
  Retry: {};
  Stale: {};
}>;

export const { Applied, Refused, Retry, Stale } = Data.taggedEnum<Decision>();

const encodeEngine = Schema.encodeEffect(Schema.toCodecJson(Refusal.Engine));

const toReason = Schema.decodeUnknownEffect(Refusal.Reason);

/** A refusal from a JSON value that carries `_tag`, as every refusal codec encodes one. */
export const reason = (json: Schema.Json) => Effect.orDie(toReason(json));

/** A refusal by the engine itself. */
export const refuse = (error: Refusal.Engine) =>
  encodeEngine(error).pipe(
    Effect.flatMap(reason),
    Effect.orDie,
    Effect.map((encoded) => Refused({ reason: encoded })),
  );

/** A space a command declared, locked, with the account's role in it. */
export interface Locked {
  readonly id: string;
  readonly kind: Sync.SpaceKind;
  readonly version: number;
  readonly keyEpoch: number | null;
  /** `null` when the account isn't a member. */
  readonly role: string | null;
}

/**
 * Locks the spaces in sorted order, so two commands never deadlock and read, check and write
 * happen under one lock. A space that doesn't exist is missing from the result.
 */
export const lock = Effect.fn("Decision.lock")(function* (
  account: string,
  spaces: ReadonlyArray<string>,
) {
  const sql = yield* SqlClient.SqlClient;
  const definition = yield* SyncSchema.Service;
  const locked = new Map<string, Locked>();

  for (const space of [...new Set(spaces)].sort()) {
    const [row] = yield* sql<{
      readonly kind: string;
      readonly version: number;
      readonly keyEpoch: number | null;
      readonly role: string | null;
    }>`
      select s.kind, s.version::float8 as version, s.key_epoch as "keyEpoch", m.role
      from space s left join space_member m on m.space_id = s.id and m.account_id = ${account}
      where s.id = ${space}
      for no key update of s
    `;

    if (row === undefined) continue;
    const kind = yield* SyncSchema.kindOf(definition, row.kind);
    locked.set(space, {
      id: space,
      kind,
      version: row.version,
      keyEpoch: row.keyEpoch,
      role: row.role,
    });
  }

  return locked;
});

/** The versions of `spaces` that moved past what `locked` read, as pokes announce them. */
export const advanced = Effect.fn("Decision.advanced")(function* (
  locked: ReadonlyMap<string, Locked>,
) {
  const sql = yield* SqlClient.SqlClient;
  const ids = [...locked.keys()];

  if (ids.length === 0) return [];

  const rows = yield* sql<{ readonly space: string; readonly version: number }>`
    select id as space, version::float8 as version from space where id in ${sql.in(ids)}
    order by id
  `;

  return rows.filter((row) => row.version !== locked.get(row.space)?.version);
});
