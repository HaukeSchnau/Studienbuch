/**
 * `Sync.inspect` on the server: the stored state of some spaces and clients for the Sync Lab. It
 * reads the size of each ciphertext and never the ciphertext, so no answer holds notebook content.
 */
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import type * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as RpcServer from "effect/rpc/RpcServer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Inspect } from "../protocol/Inspect.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { Ports } from "./Ports.ts";
import { SealCommand } from "./SealCommand.ts";

export * as Inspection from "./Inspection.ts";

const decodeJson = Schema.decodeEffect(Schema.fromJsonString(Schema.Json));

const decodeReason = Schema.decodeEffect(Schema.fromJsonString(Refusal.Reason));

/** What the server holds of the request's spaces and clients. */
export const snapshot = Effect.fn("Inspection.snapshot")(function* (request: Inspect.Request) {
  const sql = yield* SqlClient.SqlClient;
  const ids = [...new Set(request.spaces)];

  const spaces =
    ids.length === 0
      ? []
      : yield* sql<{
          readonly id: string;
          readonly kind: string;
          readonly parent: string | null;
          readonly key: string | null;
          readonly version: number;
          readonly keyEpoch: number | null;
        }>`
          select id, kind, parent_id as parent, key, version::float8 as version,
            key_epoch as "keyEpoch"
          from space where id in ${sql.in(ids)} order by id
        `;

  const members =
    ids.length === 0
      ? []
      : yield* sql<{
          readonly space: string;
          readonly account: string;
          readonly role: string;
          readonly grantedBy: string | null;
        }>`
          select space_id as space, account_id as account, role, granted_by as "grantedBy"
          from space_member where space_id in ${sql.in(ids)} order by account_id
        `;

  const rows = [];

  for (const { id } of spaces) {
    const stored = yield* sql<{
      readonly tbl: string;
      readonly id: string;
      readonly version: number;
      readonly data: string | null;
      readonly envelope: string | null;
      readonly bytes: number | null;
      readonly writtenByClient: string | null;
      readonly writtenByMutation: number | null;
    }>`
      select tbl, id, version::float8 as version, data::text as data,
        envelope::text as envelope, octet_length(ct)::float8 as bytes,
        written_by_client as "writtenByClient", written_by_mutation::float8 as "writtenByMutation"
      from sync_row where space_id = ${id}
      order by version desc, tbl, id
      limit ${request.limit}
    `;

    for (const row of stored) {
      const envelope = row.envelope === null ? null : yield* decodeJson(row.envelope);

      const state =
        row.tbl !== SealCommand.sealedTable && row.data !== null
          ? Inspect.Readable.make({ data: yield* decodeJson(row.data) })
          : row.bytes !== null && envelope !== null
            ? Inspect.Sealed.make({ envelope, bytes: row.bytes })
            : Inspect.Deleted.make({ envelope });

      rows.push({
        space: id,
        tbl: row.tbl,
        id: row.id,
        version: row.version,
        row: state,
        writtenBy:
          row.writtenByClient === null || row.writtenByMutation === null
            ? null
            : { clientId: row.writtenByClient, mutationId: row.writtenByMutation },
      } satisfies Inspect.Row);
    }
  }

  const commands = [];

  for (const client of new Set(request.clients)) {
    const logged = yield* sql<{
      readonly mutationId: number;
      readonly account: string;
      readonly kind: "Mutate" | "Seal";
      readonly name: string | null;
      readonly version: number | null;
      readonly applied: boolean;
      readonly reason: string | null;
      readonly at: number;
      readonly processedAt: number;
      readonly detail: string;
    }>`
      select mutation_id::float8 as "mutationId", account_id as account, kind, name, version,
        applied, reason::text as reason, extract(epoch from at)::float8 * 1000 as at,
        extract(epoch from processed_at)::float8 * 1000 as "processedAt", detail::text as detail
      from command_log where client_id = ${client}
      order by mutation_id desc
      limit ${request.limit}
    `;

    for (const entry of logged) {
      commands.push({
        clientId: client,
        mutationId: entry.mutationId,
        account: entry.account,
        kind: entry.kind,
        name: entry.name,
        version: entry.version,
        applied: entry.applied,
        reason: entry.reason === null ? null : yield* decodeReason(entry.reason),
        at: DateTime.makeUnsafe(entry.at),
        processedAt: DateTime.makeUnsafe(entry.processedAt),
        detail: yield* decodeJson(entry.detail),
      } satisfies Inspect.Processed);
    }
  }

  return {
    spaces: spaces.map((space) => ({
      ...space,
      members: members
        .filter((member) => member.space === space.id)
        .map(({ account, role, grantedBy }) => ({ account, role, grantedBy })),
    })),
    rows,
    commands,
  } satisfies Inspect.Response;
}, Effect.orDie);

/**
 * `Sync.inspect` at `Inspect.path`. It answers only when `answers` holds, which the server decides
 * from its environment at run time because one build serves every environment, and only to a
 * request with a valid session of any account.
 */
export const route = (answers: boolean) =>
  RpcServer.layerHttp({ group: Inspect.Rpcs, path: Inspect.path, protocol: "http" }).pipe(
    Layer.provide(
      Inspect.Rpcs.toLayer(
        Effect.gen(function* () {
          const services = yield* Effect.context<SqlClient.SqlClient>();
          const resolver = yield* Ports.SessionResolver;

          return {
            "Sync.inspect": Effect.fn("Inspection.inspect")(function* (
              request: Inspect.Request,
              { headers }: { readonly headers: Headers.Headers },
            ) {
              const session = answers ? yield* resolver.resolve(headers) : Option.none();

              if (Option.isNone(session)) return yield* new Inspect.Unavailable();

              return yield* Effect.provide(snapshot(request), services);
            }),
          };
        }),
      ),
    ),
    Layer.provide(Inspect.serialization),
  );
