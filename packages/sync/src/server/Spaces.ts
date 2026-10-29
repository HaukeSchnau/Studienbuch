/**
 * Spaces and memberships for server code outside commands, such as admitting an account to a
 * school. Each call is one transaction, or a savepoint in the caller's, so a membership change and
 * the grants it moves commit together. Every membership change pokes the account's devices on
 * commit, so they pull their new list of spaces.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type * as SqlError from "effect/sql/SqlError";
import type { Sync } from "../definition/Sync.ts";
import { Ids } from "../protocol/Ids.ts";
import { Tx } from "../transaction/Tx.ts";
import { Membership } from "./Membership.ts";
import { Pokes } from "./Pokes.ts";
import { PostgresTx } from "./PostgresTx.ts";
import { SyncSchema } from "./SyncSchema.ts";

export * as Spaces from "./Spaces.ts";

export class Service extends Context.Service<
  Service,
  {
    /**
     * Creates the space with no rows and no members, or does nothing when it exists alike. A
     * sealed space starts without a key epoch: its owner's device opens epoch 0. `parent` is the
     * space it belongs to, such as a notebook's or a course's school, and `key` the id the
     * parent's rows use for it, which membership rules name.
     */
    readonly create: (
      id: string,
      kind: Sync.SpaceKind,
      options?: Placement,
    ) => Effect.Effect<void, SqlError.SqlError>;
    /**
     * Adds the account with `role`, or changes its role. The space must exist. The membership
     * rules of its child spaces the account reads apply again.
     */
    readonly addMember: (
      space: string,
      account: string,
      role: string,
    ) => Effect.Effect<void, SqlError.SqlError>;
    /**
     * Removes the account, which then gets the space in a pull's `removed`, and the memberships
     * the space and its children granted it, such as the courses of a notebook it left or of a
     * school it left.
     */
    readonly removeMember: (
      space: string,
      account: string,
    ) => Effect.Effect<void, SqlError.SqlError>;
  }
>()("@stu/sync/server/Spaces") {}

export interface Placement {
  readonly parent?: string;
  readonly key?: string;
}

const fitsId = Schema.is(Ids.Id);

const isId = (id: string): boolean => fitsId(id);

const isTxRefusal = Schema.is(Tx.Refused);

export const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const definition = yield* SyncSchema.Service;
  const withSql = Effect.provideService(SqlClient.SqlClient, sql);

  const membershipTables = [...new Set(definition.membership.map((rule) => rule.from))];

  /**
   * Applies the membership rules of `spaces` again, as a write of their rows does, and pokes the
   * accounts whose memberships changed.
   */
  const regrant = Effect.fnUntraced(function* (spaces: ReadonlyArray<string>) {
    if (membershipTables.length === 0 || spaces.length === 0) return;
    const tx = yield* PostgresTx.make({ actor: "", writes: [] });
    const changed = new Set<string>();

    for (const space of spaces) {
      const accounts = yield* Membership.apply(definition, space, membershipTables).pipe(
        Effect.provideService(Tx.Service, tx),
        // The rows a rule reads were written through their table's codec.
        Effect.catchIf(isTxRefusal, Effect.die),
      );

      for (const account of accounts) changed.add(account);
    }

    yield* Pokes.notify({ spaces: [], accounts: [...changed].sort() });
  });

  const children = (parent: string, account?: string) =>
    Effect.map(
      account === undefined
        ? sql<{ readonly id: string }>`select id from space where parent_id = ${parent} order by id`
        : sql<{ readonly id: string }>`
            select s.id from space s join space_member m on m.space_id = s.id
            where s.parent_id = ${parent} and m.account_id = ${account}
            order by s.id
          `,
      (rows) => rows.map((row) => row.id),
    );

  const kindOfSpace = Effect.fnUntraced(function* (space: string) {
    const [row] = yield* sql<{ readonly kind: string }>`select kind from space where id = ${space}`;

    if (row === undefined) return yield* Effect.die(`The space ${space} doesn't exist`);

    return yield* SyncSchema.kindOf(definition, row.kind);
  });

  return Service.of({
    create: Effect.fn("Spaces.create")(
      function* (id: string, kind: Sync.SpaceKind, options?: Placement) {
        const parent = options?.parent ?? null;
        const key = options?.key ?? null;

        if (!isId(id)) return yield* Effect.die(`The space id ${id} is outside Ids.Id`);

        if (definition.byName.spaceKinds.get(kind.name) !== kind) {
          return yield* Effect.die(`The space kind ${kind.name} isn't the definition's`);
        }

        if (key !== null && parent === null) {
          return yield* Effect.die(`The space ${id} has a key but no parent`);
        }

        const created = yield* sql`
        insert into space (id, kind, parent_id, key) values (${id}, ${kind.name}, ${parent}, ${key})
        on conflict (id) do nothing
        returning 1
      `;

        const [row] = yield* sql<{
          readonly kind: string;
          readonly parent: string | null;
          readonly key: string | null;
        }>`select kind, parent_id as parent, key from space where id = ${id}`;

        if (row?.kind !== kind.name || row.parent !== parent || row.key !== key) {
          return yield* Effect.die(`The space ${id} exists with another kind or place`);
        }

        // Notebooks that chose a course before its space existed read it from now on.
        if (created.length > 0 && parent !== null && key !== null) {
          yield* regrant(yield* children(parent));
        }
      },
      sql.withTransaction,
      withSql,
    ),

    addMember: Effect.fn("Spaces.addMember")(
      function* (space: string, account: string, role: string) {
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

        if (changed.length === 0) return;
        yield* Pokes.notify({ spaces: [], accounts: [account] });
        // An account back at a school reads the courses its notebook there names again.
        yield* regrant(yield* children(space, account));
      },
      sql.withTransaction,
      withSql,
    ),

    removeMember: Effect.fn("Spaces.removeMember")(
      function* (space: string, account: string) {
        // A rule granting from this space or a child of it holds this row for share, so one waits
        // for the other.
        yield* sql`
        select 1 from space_member where space_id = ${space} and account_id = ${account}
        for update
      `;

        const removed = yield* sql`
        delete from space_member
        where account_id = ${account}
          and (
            space_id = ${space}
            or granted_by = ${space}
            or granted_by in (select id from space where parent_id = ${space})
          )
        returning 1
      `;

        if (removed.length > 0) yield* Pokes.notify({ spaces: [], accounts: [account] });
      },
      sql.withTransaction,
      withSql,
    ),
  });
});

export const layer = Layer.effect(Service, make);
