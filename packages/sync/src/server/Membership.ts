/**
 * Memberships that follow rows (`Sync.membershipRule`): a member of a space holds a role in the
 * spaces its rows name, such as a notebook's owner reading the courses its `Enrollment` lists. The
 * server applies the rules in the transaction that wrote their table.
 */
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import { Sync } from "../definition/Sync.ts";

export * as Membership from "./Membership.ts";

/**
 * Applies the rules over `written` tables for `space`'s rows, and returns the accounts whose
 * memberships changed. Rows name spaces by key within `space`'s parent, so a notebook reaches only
 * its own school's courses, and only members who read the parent receive them.
 */
export const apply = Effect.fn("Membership.apply")(function* (
  definition: Sync.Definition,
  space: string,
  written: ReadonlyArray<Sync.Any>,
) {
  const sql = yield* SqlClient.SqlClient;
  const changed = new Set<string>();
  const rules = definition.membership.filter((rule) => written.includes(rule.from));

  if (rules.length === 0) return [];

  const [granting] = yield* sql<{ readonly parent: string | null }>`
    select parent_id as parent from space where id = ${space}
  `;

  const parent = granting?.parent ?? null;

  const members =
    parent === null
      ? []
      : yield* sql<{ readonly account: string }>`
          select m.account_id as account from space_member m
          join space_member p on p.account_id = m.account_id and p.space_id = ${parent}
          where m.space_id = ${space}
        `;

  /** The spaces of `kind` under the granting space's parent whose keys the rows named. */
  const existing = (kind: string, keys: ReadonlyArray<string>) =>
    parent === null || keys.length === 0
      ? Effect.succeed([])
      : sql<{ readonly id: string }>`
          select id from space
          where parent_id = ${parent} and kind = ${kind} and key in ${sql.in(keys)}
          order by id
        `.pipe(Effect.map((rows) => rows.map((row) => row.id)));

  for (const rule of rules) {
    const granted = yield* Sync.grants(rule, space, existing);

    const held = yield* sql<{ readonly space: string; readonly account: string }>`
      select m.space_id as space, m.account_id as account
      from space_member m join space s on s.id = m.space_id
      where m.granted_by = ${space} and s.kind = ${rule.kind.name}
    `;

    const key = (target: string, account: string) => JSON.stringify([target, account]);
    const heldKeys = new Set(held.map((row) => key(row.space, row.account)));

    const wanted = granted.flatMap((target) =>
      members.map(({ account }) => ({ space: target, account })),
    );

    const wantedKeys = new Set(wanted.map((row) => key(row.space, row.account)));

    for (const row of wanted.filter((row) => !heldKeys.has(key(row.space, row.account)))) {
      // An account that already reads the space through another source keeps that membership.
      const added = yield* sql`
        insert into space_member (space_id, account_id, role, granted_by)
        values (${row.space}, ${row.account}, ${rule.role}, ${space})
        on conflict (space_id, account_id) do nothing
        returning 1
      `;

      if (added.length > 0) changed.add(row.account);
    }

    for (const row of held.filter((row) => !wantedKeys.has(key(row.space, row.account)))) {
      yield* sql`
        delete from space_member
        where space_id = ${row.space} and account_id = ${row.account} and granted_by = ${space}
      `;
      changed.add(row.account);
    }
  }

  return [...changed].sort();
});
