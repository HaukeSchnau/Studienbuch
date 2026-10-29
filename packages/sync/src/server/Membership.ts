/**
 * Memberships that follow rows (`Sync.membershipRule`): whoever is a member of a space holds a
 * role in the spaces its rows name, such as a notebook's owner reading the courses its
 * `Enrollment` lists. The server applies the rules in the transaction that wrote their table.
 */
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import { Sync } from "../definition/Sync.ts";

export * as Membership from "./Membership.ts";

/** The given ids that exist as spaces of `kind`. */
const existing = (kind: string, spaces: ReadonlyArray<string>) =>
  Effect.flatMap(SqlClient.SqlClient, (sql) =>
    spaces.length === 0
      ? Effect.succeed([])
      : sql<{ readonly id: string }>`
          select id from space where kind = ${kind} and id in ${sql.in(spaces)} order by id
        `.pipe(Effect.map((rows) => rows.map((row) => row.id))),
  );

/**
 * Evaluates the rules over `written` tables for `space`'s current rows and applies the difference
 * to the memberships the rules granted from it. Returns the accounts whose memberships changed.
 */
export const apply = Effect.fn("Membership.apply")(function* (
  definition: Sync.Definition,
  space: string,
  written: ReadonlyArray<Sync.Any>,
) {
  const sql = yield* SqlClient.SqlClient;
  const changed = new Set<string>();

  for (const rule of definition.membership.filter((rule) => written.includes(rule.from))) {
    const granted = yield* Sync.grants(rule, space, existing);

    const members = yield* sql<{ readonly account: string }>`
      select account_id as account from space_member where space_id = ${space}
    `;

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
