/**
 * Spaces and memberships for server code outside commands, such as admitting an account to a
 * school. Each call joins the caller's transaction when one is open, and every membership change
 * pokes the account's devices on commit, so they pull their new list of spaces.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type * as SqlError from "effect/sql/SqlError";
import type { Sync } from "../definition/Sync.ts";
import { Ids } from "../protocol/Ids.ts";
import { Pokes } from "./Pokes.ts";
import { SyncSchema } from "./SyncSchema.ts";

export * as Spaces from "./Spaces.ts";

export class Service extends Context.Service<
  Service,
  {
    /**
     * Creates the space with no rows and no members, or does nothing when it exists with this
     * kind. A sealed space starts without a key epoch: its owner's device opens epoch 0.
     */
    readonly create: (id: string, kind: Sync.SpaceKind) => Effect.Effect<void, SqlError.SqlError>;
    /** Adds the account with `role`, or changes its role. The space must exist. */
    readonly addMember: (
      space: string,
      account: string,
      role: string,
    ) => Effect.Effect<void, SqlError.SqlError>;
    /** Removes the account, which then gets the space in a pull's `removed`. */
    readonly removeMember: (
      space: string,
      account: string,
    ) => Effect.Effect<void, SqlError.SqlError>;
  }
>()("@stu/sync/server/Spaces") {}

const fitsId = Schema.is(Ids.Id);

const isId = (id: string): boolean => fitsId(id);

export const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const definition = yield* SyncSchema.Service;
  const withSql = Effect.provideService(SqlClient.SqlClient, sql);

  const kindOfSpace = Effect.fnUntraced(function* (space: string) {
    const [row] = yield* sql<{ readonly kind: string }>`select kind from space where id = ${space}`;

    if (row === undefined) return yield* Effect.die(`The space ${space} doesn't exist`);

    return yield* SyncSchema.kindOf(definition, row.kind);
  });

  return Service.of({
    create: Effect.fn("Spaces.create")(function* (id: string, kind: Sync.SpaceKind) {
      if (!isId(id)) return yield* Effect.die(`The space id ${id} is outside Ids.Id`);

      if (definition.byName.spaceKinds.get(kind.name) !== kind) {
        return yield* Effect.die(`The space kind ${kind.name} isn't the definition's`);
      }

      yield* sql`insert into space (id, kind) values (${id}, ${kind.name}) on conflict (id) do nothing`;
      const [row] = yield* sql<{ readonly kind: string }>`select kind from space where id = ${id}`;

      if (row?.kind !== kind.name) {
        return yield* Effect.die(`The space ${id} exists with another kind`);
      }
    }),

    addMember: Effect.fn("Spaces.addMember")(function* (
      space: string,
      account: string,
      role: string,
    ) {
      const kind = yield* kindOfSpace(space);

      if (!kind.roles.includes(role)) {
        return yield* Effect.die(`The space kind ${kind.name} has no role ${role}`);
      }

      if (!isId(account)) return yield* Effect.die(`The account id ${account} is outside Ids.Id`);

      const changed = yield* sql`
        insert into space_member (space_id, account_id, role, granted_by)
        values (${space}, ${account}, ${role}, null)
        on conflict (space_id, account_id) do update
        set role = excluded.role, granted_by = null
        where space_member.role <> excluded.role or space_member.granted_by is not null
        returning 1
      `;

      if (changed.length > 0) yield* Pokes.notify({ spaces: [], accounts: [account] });
    }, withSql),

    removeMember: Effect.fn("Spaces.removeMember")(function* (space: string, account: string) {
      const removed = yield* sql`
        delete from space_member where space_id = ${space} and account_id = ${account}
        returning 1
      `;

      if (removed.length > 0) yield* Pokes.notify({ spaces: [], accounts: [account] });
    }, withSql),
  });
});

export const layer = Layer.effect(Service, make);
