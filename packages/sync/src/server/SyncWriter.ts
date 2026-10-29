/**
 * How server code writes readable rows outside commands: the import, admissions, backfills. Each
 * write is an ordinary versioned change that devices receive through their pulls, with the
 * membership rules applied and a poke on commit. Writes join the caller's transaction when one is
 * open.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as SqlClient from "effect/sql/SqlClient";
import type { Sync } from "../definition/Sync.ts";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import { Tx } from "../transaction/Tx.ts";
import { Membership } from "./Membership.ts";
import { Pokes } from "./Pokes.ts";
import { PostgresTx } from "./PostgresTx.ts";
import { SyncSchema } from "./SyncSchema.ts";

export * as SyncWriter from "./SyncWriter.ts";

export interface Reconciled {
  readonly written: number;
  readonly removed: number;
}

export class Service extends Context.Service<
  Service,
  {
    /**
     * Runs `effect` with a `Tx` that writes `tables` in `space` only, under the space's lock. All
     * of its writes share one version. The server holds no key, so an encrypted table dies.
     */
    readonly write: <A, E>(
      space: string,
      tables: ReadonlyArray<Sync.Any>,
      effect: Effect.Effect<A, E, Tx.Service>,
    ) => Effect.Effect<A, E | Tx.Error>;
    /**
     * Makes `table` in `space` hold `rows`: writes the new and changed ones, compared by canonical
     * JSON, and deletes the existing rows that `covers` claims and `rows` lacks. Without `covers`
     * it deletes nothing, because a missing observation isn't a deletion. A call that changes
     * nothing writes nothing and wakes no device.
     */
    readonly reconcile: <T extends Sync.Any>(
      space: string,
      table: T,
      rows: ReadonlyArray<Tx.Entry<Sync.Row<T>>>,
      options?: { readonly covers?: (entry: Tx.Entry<Sync.Row<T>>) => boolean },
    ) => Effect.Effect<Reconciled, Tx.Error>;
  }
>()("@stu/sync/server/SyncWriter") {}

/** Server writes run for no account. */
const serverActor = "";

export const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const definition = yield* SyncSchema.Service;

  const versionOf = (space: string) =>
    sql<{ readonly version: number }>`
      select version::float8 as version from space where id = ${space}
    `.pipe(Effect.map(([row]) => row?.version));

  const write = <A, E>(
    space: string,
    tables: ReadonlyArray<Sync.Any>,
    effect: Effect.Effect<A, E, Tx.Service>,
  ) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          const [locked] = yield* sql<{ readonly version: number }>`
          select version::float8 as version from space where id = ${space} for no key update
        `;

          if (locked === undefined) return yield* Effect.die(`The space ${space} doesn't exist`);

          const tx = yield* PostgresTx.make({
            actor: serverActor,
            writes: tables,
            spaces: [space],
          });

          const result = yield* Effect.provideService(effect, Tx.Service, tx);
          const version = yield* versionOf(space);

          if (version === locked.version) return result;

          const accounts = yield* Effect.provideService(
            Membership.apply(definition, space, tables),
            Tx.Service,
            tx,
          );

          yield* Pokes.notify({
            spaces: version === undefined ? [] : [{ space, version }],
            accounts,
          });

          return result;
        }),
      )
      .pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.withSpan("SyncWriter.write", { attributes: { space } }),
      );

  const canonical = <T extends Sync.Any>(table: T, space: string, entry: Tx.Entry<Sync.Row<T>>) =>
    Tx.canonical(table, entry.row).pipe(
      Effect.catchTags({
        SchemaError: (error) =>
          Effect.fail(
            new Tx.InvalidRow({ table: table.name, space, id: entry.id, message: error.message }),
          ),
      }),
    );

  const reconcile = <T extends Sync.Any>(
    space: string,
    table: T,
    rows: ReadonlyArray<Tx.Entry<Sync.Row<T>>>,
    options?: { readonly covers?: (entry: Tx.Entry<Sync.Row<T>>) => boolean },
  ) =>
    write(
      space,
      [table],
      Effect.gen(function* () {
        const tx = yield* Tx.Service;

        const stored = yield* sql<{ readonly id: string; readonly data: string }>`
          select id, data::text as data from sync_row
          where space_id = ${space} and tbl = ${table.name} and data is not null
        `;

        // Rows another build wrote compare as different, so the desired rows replace them.
        const current = new Map(
          stored.map(({ id, data }) => [id, Result.getOrUndefined(CanonicalJson.normalize(data))]),
        );

        let written = 0;

        for (const entry of rows) {
          if (current.get(entry.id) === (yield* canonical(table, space, entry))) continue;
          yield* tx.put(table, space, entry.id, entry.row);
          written++;
        }

        const covers = options?.covers;
        const wanted = new Set(rows.map((entry) => entry.id));
        let removed = 0;

        if (covers !== undefined) {
          for (const entry of yield* tx.list(table, space)) {
            if (wanted.has(entry.id) || !covers(entry)) continue;
            yield* tx.remove(table, space, entry.id);
            removed++;
          }
        }

        return { written, removed } satisfies Reconciled;
      }),
    ).pipe(Effect.withSpan("SyncWriter.reconcile", { attributes: { space, table: table.name } }));

  return Service.of({ write, reconcile });
});

export const layer = Layer.effect(Service, make);
