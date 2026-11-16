/**
 * Memberships that follow rows (`Sync.membershipRule`): a member of a space holds a role in the
 * spaces its rows name, such as a notebook's owner reading the courses its `Enrollment` lists. The
 * server applies the rules in the transaction that wrote their table.
 */
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import { Sync } from "../definition/Sync.ts";

export * as Membership from "./Membership.ts";

/** A membership a rule grants: `account` reads `space` with `role`, because of `grantor`'s rows. */
interface Grant {
  readonly space: string;
  readonly account: string;
  readonly role: string;
  readonly grantor: string;
}

/**
 * Applies the rules over `written` tables to `spaces` in one delete and one insert, and returns
 * the accounts whose memberships changed. Rows name spaces by key in their space's parent, for
 * members who read the parent. The caller holds each space's lock while this reads its rows, and
 * the parent memberships stay locked until commit, so no write or leave overlaps the grant.
 */
export const apply = Effect.fn("Membership.apply")(function* (
  definition: Sync.Definition,
  spaces: ReadonlyArray<string>,
  written: ReadonlyArray<Sync.Any>,
) {
  const sql = yield* SqlClient.SqlClient;
  const rules = definition.membership.filter((rule) => written.includes(rule.from));

  if (rules.length === 0 || spaces.length === 0) return [];

  const members = yield* sql<{
    readonly space: string;
    readonly parent: string;
    readonly account: string;
  }>`
    select m.space_id as space, s.parent_id as parent, m.account_id as account
    from space s
    join space_member m on m.space_id = s.id
    join space_member p on p.account_id = m.account_id and p.space_id = s.parent_id
    where s.id = any(${spaces})
    for share of m, p
  `;

  const parents = new Map<string, string>();
  const accounts = new Map<string, Array<string>>();

  for (const { space, parent, account } of members) {
    parents.set(space, parent);
    accounts.set(space, [...(accounts.get(space) ?? []), account]);
  }

  const wanted: Array<Grant> = [];

  for (const rule of rules) {
    const named: Array<{
      readonly grantor: string;
      readonly parent: string;
      readonly key: string;
    }> = [];

    for (const [space, parent] of parents) {
      // All keys the rows name. The query below keeps those that name a space of the rule's kind.
      const keys = yield* Sync.grants(rule, space, (_kind, keys) => Effect.succeed(keys));

      for (const key of keys) named.push({ grantor: space, parent, key });
    }

    const granted =
      named.length === 0
        ? []
        : yield* sql<{ readonly grantor: string; readonly space: string }>`
            select w.grantor, s.id as space
            from unnest(
              ${named.map((row) => row.grantor)}::text[],
              ${named.map((row) => row.parent)}::text[],
              ${named.map((row) => row.key)}::text[]
            ) as w(grantor, parent, key)
            join space s on s.parent_id = w.parent and s.key = w.key and s.kind = ${rule.kind.name}
          `;

    for (const { grantor, space } of granted) {
      for (const account of accounts.get(grantor) ?? []) {
        wanted.push({ space, account, role: rule.role, grantor });
      }
    }
  }

  const column = (field: keyof Grant) => wanted.map((grant) => grant[field]);

  // Deletes first, so a membership that moves to another granting space in this call stays.
  const removed = yield* sql<{ readonly account: string }>`
    delete from space_member m using space s
    where s.id = m.space_id
      and m.granted_by = any(${spaces})
      and s.kind = any(${rules.map((rule) => rule.kind.name)})
      and (m.space_id, m.account_id, m.granted_by) not in (
        select * from unnest(${column("space")}::text[], ${column("account")}::text[],
          ${column("grantor")}::text[])
      )
    returning m.account_id as account
  `;

  // An account that already reads the space through another source keeps that membership. Rows go
  // in key order, so two transactions granting the same memberships wait rather than deadlock.
  const added =
    wanted.length === 0
      ? []
      : yield* sql<{ readonly account: string }>`
          insert into space_member (space_id, account_id, role, granted_by)
          select * from unnest(
            ${column("space")}::text[], ${column("account")}::text[], ${column("role")}::text[],
            ${column("grantor")}::text[]
          )
          order by 1, 2
          on conflict (space_id, account_id) do nothing
          returning account_id as account
        `;

  return [...new Set([...removed, ...added].map((row) => row.account))].sort();
});
