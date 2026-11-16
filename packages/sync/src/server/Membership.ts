/**
 * Memberships that follow rows (`Sync.membershipRule`): a member of a space holds a role in the
 * spaces its rows name, such as a notebook's owner reading the courses its `Enrollment` lists. The
 * server applies the rules in the transaction that wrote their table.
 */
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";
import { Sync } from "../definition/Sync.ts";

export * as Membership from "./Membership.ts";

const Ids = Schema.Array(Schema.String);

/** The spaces a rule applies to, and the keys their rows named as pairs, one column each. */
const Named = Schema.Struct({ spaces: Ids, granting: Ids, keys: Ids });

const Changed = Schema.Struct({ account: Schema.String });

/**
 * Applies the rules over `written` tables for the rows of `spaces`, in three statements per rule
 * however many spaces, and returns the accounts whose memberships changed. Rows name spaces by key
 * within their space's parent, so a notebook reaches only its own school's courses, and only
 * members who read the parent receive them.
 */
export const apply = Effect.fn("Membership.apply")(
  function* (
    definition: Sync.Definition,
    spaces: ReadonlyArray<string>,
    written: ReadonlyArray<Sync.Any>,
  ) {
    const sql = yield* SqlClient.SqlClient;
    const changed = new Set<string>();
    const rules = definition.membership.filter((rule) => written.includes(rule.from));

    for (const rule of spaces.length === 0 ? [] : rules) {
      const rows = yield* SqlSchema.findAll({
        Request: Ids,
        Result: Schema.Struct({
          space: Schema.String,
          id: Schema.String,
          row: Schema.fromJsonString(rule.from.codec),
        }),
        execute: (spaces) => sql`
          select space_id as space, id, data::text as row from sync_row
          where tbl = ${rule.from.name} and space_id = any(${spaces}::text[]) and data is not null
          order by space_id, id
        `,
      })(spaces);

      const named = Object.entries(Arr.groupBy(rows, (row) => row.space)).flatMap(
        ([space, entries]) => Sync.grants(rule, entries).map((key) => ({ space, key })),
      );

      // Each named space of the rule's kind under the granting space's parent, for each member of
      // the granting space who reads that parent. Both writes hold those two memberships for share
      // until commit, so leaving the parent waits for the grant, or the reverse.
      const wanted = (request: typeof Named.Encoded) => sql`
        select t.id as space_id, m.account_id, g.id as granted_by
        from unnest(${request.granting}::text[], ${request.keys}::text[]) as n(space, key)
        join space g on g.id = n.space
        join space t on t.parent_id = g.parent_id and t.kind = ${rule.kind.name} and t.key = n.key
        join space_member m on m.space_id = g.id
        join space_member p on p.space_id = g.parent_id and p.account_id = m.account_id
        for share of m, p
      `;

      const remove = SqlSchema.findAll({
        Request: Named,
        Result: Changed,
        execute: (request) => sql`
          with wanted as (${wanted(request)})
          delete from space_member d using space s
          where s.id = d.space_id and s.kind = ${rule.kind.name}
            and d.granted_by = any(${request.spaces}::text[])
            and (d.space_id, d.account_id, d.granted_by) not in (
              select space_id, account_id, granted_by from wanted
            )
          returning d.account_id as account
        `,
      });

      // An account that already reads the space through another source keeps that membership. The
      // rows go in one order, so two transactions granting the same ones wait instead of deadlock.
      const add = SqlSchema.findAll({
        Request: Named,
        Result: Changed,
        execute: (request) => sql`
          with wanted as (${wanted(request)})
          insert into space_member (space_id, account_id, role, granted_by)
          select space_id, account_id, ${rule.role}::text, granted_by from wanted
          order by space_id, account_id, granted_by
          on conflict (space_id, account_id) do nothing
          returning account_id as account
        `,
      });

      const request = {
        spaces,
        granting: named.map((pair) => pair.space),
        keys: named.map((pair) => pair.key),
      };

      for (const { account } of [...(yield* remove(request)), ...(yield* add(request))]) {
        changed.add(account);
      }
    }

    return [...changed].sort();
  },
  // Every row of the rule's table went in through its codec.
  Effect.catchTags({ SchemaError: Effect.die }),
);
