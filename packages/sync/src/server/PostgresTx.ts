/**
 * The server's `Tx` on Postgres. The first write to a space in a transaction bumps the space's
 * version under its row lock, and every row the transaction writes there carries that version, so
 * version order equals commit order (ADR 0019). Deletes leave a tombstone.
 *
 * Provide a fresh layer per transaction, because the bumped versions belong to it:
 *
 * ```ts
 * sql.withTransaction(mutator.run(args).pipe(Effect.provide(PostgresTx.layer(runner))))
 * ```
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import { Tx } from "../transaction/Tx.ts";

export * as PostgresTx from "./PostgresTx.ts";

export interface Runner extends Tx.Runner {
  /**
   * The spaces a command declared. A write to another space is a defect, like a write to an
   * undeclared table. Without it, the transaction may write any space that exists.
   */
  readonly spaces?: ReadonlyArray<string>;
  /**
   * Reads only spaces that `actor` is a member of, as a device holds no others. A command's run
   * sets it, so a forged command can't read another school's rows. Server code reads every space.
   */
  readonly asMember?: boolean;
}

/** The server's `Tx` for a command of the connection's account, or for the server's own writes. */
export const make = Effect.fnUntraced(function* (runner: Runner) {
  const sql = yield* SqlClient.SqlClient;
  const versions = new Map<string, number>();
  const declared = runner.spaces === undefined ? undefined : new Set(runner.spaces);

  const memberships =
    runner.asMember === true
      ? yield* Effect.cached(
          sql<{ readonly space: string }>`
            select space_id as space from space_member where account_id = ${runner.actor}
          `.pipe(Effect.map((rows) => new Set(rows.map((row) => row.space)))),
        )
      : undefined;

  /** Runs `read` on a space the transaction sees, and answers `none` for any other. */
  const visible = <A, E>(space: string, read: Effect.Effect<A, E>, none: A) =>
    memberships === undefined
      ? read
      : Effect.flatMap(memberships, (spaces) => (spaces.has(space) ? read : Effect.succeed(none)));

  const version = (space: string) => {
    const known = versions.get(space);

    if (known !== undefined) return Effect.succeed(known);

    if (declared !== undefined && !declared.has(space)) {
      return Effect.die(`A write to space ${space}, which the command doesn't declare`);
    }

    return sql<{ readonly version: number }>`
      update space set version = version + 1 where id = ${space}
      returning version::float8 as version
    `.pipe(
      Effect.flatMap(([row]) =>
        row === undefined
          ? Effect.die(`A write to space ${space}, which doesn't exist`)
          : Effect.succeed(row.version),
      ),
      Effect.tap((bumped) => Effect.sync(() => versions.set(space, bumped))),
    );
  };

  return Tx.make({
    actor: runner.actor,
    writes: runner.writes,
    location: "server",

    read: (space, table, id) =>
      visible(
        space,
        sql<{ readonly data: string }>`
          select data::text as data from sync_row
          where space_id = ${space} and tbl = ${table} and id = ${id} and data is not null
        `.pipe(Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), (row) => row.data))),
        Option.none(),
      ),

    list: (space, table, filter) =>
      visible(
        space,
        filter === undefined
          ? sql<{ readonly id: string; readonly data: string }>`
              select id, data::text as data from sync_row
              where space_id = ${space} and tbl = ${table} and data is not null
              order by id
            `
          : sql<{ readonly id: string; readonly data: string }>`
              select id, data::text as data from sync_row
              where space_id = ${space} and tbl = ${table}
                and data -> (${filter.field}::text) = ${filter.json}::jsonb
              order by id
            `,
        [],
      ),

    write: (space, table, id, data) =>
      Effect.flatMap(
        version(space),
        (bumped) => sql`
          insert into sync_row (space_id, tbl, id, version, data)
          values (${space}, ${table}, ${id}, ${bumped}, ${data}::jsonb)
          on conflict (space_id, tbl, id) do update
          set version = excluded.version, data = excluded.data,
            written_by_client = null, written_by_mutation = null
        `,
      ).pipe(Effect.asVoid),
  });
});

export const layer = (runner: Runner) => Layer.effect(Tx.Service, make(runner));
