/**
 * `Sync.pull`: everything a device receives, read in one `REPEATABLE READ READ ONLY` snapshot, so
 * the last mutation id never leads the rows and a commit that wrote two spaces arrives whole
 * (ADR 0019). Pages end at version boundaries, and the last mutation id and the refusals come with
 * the last page only.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Protocol } from "../protocol/Protocol.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { Contract } from "./Contract.ts";
import { SealCommand } from "./SealCommand.ts";
import { SyncEpoch } from "./SyncEpoch.ts";

export * as Pull from "./Pull.ts";

export class Service extends Context.Service<
  Service,
  {
    /** Runs a pull for the connection's account. */
    readonly pull: (
      account: string,
      request: Protocol.PullRequest,
    ) => Effect.Effect<Protocol.PullResponse, typeof Protocol.PullError.Type>;
  }
>()("@stu/sync/server/Pull") {}

interface Stored {
  readonly tbl: string;
  readonly id: string;
  readonly version: number;
  readonly data: string | null;
  readonly envelope: string | null;
  readonly ct: Uint8Array | null;
}

/**
 * How many of `rows`, ordered by version and fetched with one more than `limit`, fit on a page
 * without splitting a version. `complete` when every row fit.
 */
export const cut = (rows: ReadonlyArray<{ readonly version: number }>, limit: number) => {
  if (rows.length <= limit) return { take: rows.length, complete: true };
  const cutVersion = rows[limit]?.version;
  let take = limit;

  while (take > 0 && rows[take - 1]?.version === cutVersion) take--;

  return { take, complete: false };
};

const decodeJson = Schema.decodeEffect(Schema.fromJsonString(Schema.Json));

const decodeReason = Schema.decodeEffect(Schema.fromJsonString(Refusal.Reason));

// Runs once per row of a pull, so it carries no span.
const toOp = Effect.fnUntraced(function* (row: Stored) {
  const sealed = row.tbl === SealCommand.sealedTable;

  const live =
    sealed && row.ct !== null && row.envelope !== null
      ? Protocol.Sealed.make({ envelope: yield* decodeJson(row.envelope), ct: row.ct })
      : !sealed && row.data !== null
        ? Protocol.Readable.make({ data: yield* decodeJson(row.data) })
        : Protocol.Deleted.make({});

  return { tbl: row.tbl, id: row.id, version: row.version, row: live } satisfies Protocol.Op;
}, Effect.orDie);

/** Rows per page at most, whatever a request asks for. */
export const maxLimit = 1000;

export const make = Effect.fn("Pull.make")(function* (minimum: Contract.Minimum) {
  const sql = yield* SqlClient.SqlClient;
  const services = yield* Effect.context<SqlClient.SqlClient>();

  const rows = (space: string, after: number, reset: boolean, limit: number) =>
    sql<Stored>`
        select tbl, id, version::float8 as version, data::text as data,
          envelope::text as envelope, ct
        from sync_row
        where space_id = ${space} and version > ${after}
          and (${!reset} or data is not null or ct is not null)
        order by version, tbl, id
        limit ${limit}
      `;

  const versionRows = (space: string, version: number, reset: boolean) =>
    sql<Stored>`
        select tbl, id, version::float8 as version, data::text as data,
          envelope::text as envelope, ct
        from sync_row
        where space_id = ${space} and version = ${version}
          and (${!reset} or data is not null or ct is not null)
        order by tbl, id
      `;

  const snapshot = Effect.fnUntraced(function* (account: string, request: Protocol.PullRequest) {
    yield* sql`set transaction isolation level repeatable read, read only`;
    const syncEpoch = yield* SyncEpoch.current;

    const [client] = yield* sql<{ readonly account: string; readonly lastMutationId: number }>`
        select account_id as account, last_mutation_id::float8 as "lastMutationId"
        from sync_client where id = ${request.clientId}
      `;

    if (client !== undefined && client.account !== account) {
      return yield* new Protocol.ClientUnknown();
    }

    const lastMutationId = client?.lastMutationId ?? 0;

    const spaces = yield* sql<typeof Protocol.Space.Type>`
        select s.id, s.kind, m.role, s.version::float8 as version, s.key_epoch as "keyEpoch"
        from space_member m join space s on s.id = m.space_id
        where m.account_id = ${account}
        order by s.id
      `;

    const cursors = new Map(request.cursors.map((cursor) => [cursor.space, cursor.version]));

    // A cursor or settled id the server never handed out means the database went back in time.
    const rewound =
      (request.syncEpoch !== null && request.syncEpoch !== syncEpoch) ||
      request.settledMutationId > lastMutationId ||
      spaces.some((space) => (cursors.get(space.id) ?? 0) > space.version);

    if (rewound) return yield* new Protocol.EpochChanged({ syncEpoch, lastMutationId });
    const readable = new Set(spaces.map((space) => space.id));
    const removed = [...cursors.keys()].filter((space) => !readable.has(space)).sort();
    const patches: Array<Protocol.Patch> = [];
    let remaining = Math.min(request.limit, maxLimit);
    let more = false;

    for (const space of spaces) {
      const cursor = cursors.get(space.id);

      if (cursor === space.version) continue;

      if (remaining === 0) {
        more = true;
        break;
      }

      const reset = cursor === undefined;
      const fetched = yield* rows(space.id, cursor ?? 0, reset, remaining + 1);
      const { take, complete } = cut(fetched, remaining);
      const first = fetched[0]?.version ?? 0;

      if (take === 0 && !complete && patches.length > 0) {
        more = true;
        break;
      }

      // One commit wrote more rows than a page holds, so this page is that commit alone.
      const page =
        take === 0 && !complete
          ? yield* versionRows(space.id, first, reset)
          : fetched.slice(0, take);

      patches.push({
        space: space.id,
        reset,
        to: complete ? space.version : (page.at(-1)?.version ?? first),
        ops: yield* Effect.forEach(page, toOp),
      });

      remaining = Math.max(0, remaining - page.length);

      if (!complete) {
        more = true;
        break;
      }
    }

    const refused = more
      ? []
      : yield* sql<{ readonly mutationId: number; readonly reason: string }>`
            select mutation_id::float8 as "mutationId", reason::text as reason from command_log
            where client_id = ${request.clientId} and mutation_id > ${request.settledMutationId}
              and not applied
            order by mutation_id
          `;

    const refusals = yield* Effect.forEach(refused, ({ mutationId, reason }) =>
      Effect.map(Effect.orDie(decodeReason(reason)), (decoded) => ({
        mutationId,
        reason: decoded,
      })),
    );

    return {
      syncEpoch,
      spaces,
      patches,
      removed,
      lastMutationId: more ? null : lastMutationId,
      refusals,
      more,
    } satisfies Protocol.PullResponse;
  });

  const pull = Effect.fn("Pull.pull")(
    function* (account: string, request: Protocol.PullRequest) {
      yield* Contract.admit(request.contract, minimum);
      const response = yield* sql.withTransaction(snapshot(account, request));

      yield* Contract.sendable(request.contract, minimum, [
        ...response.patches.flatMap((patch) => patch.ops.map((op) => op.row._tag)),
        ...response.refusals.map((refusal) => refusal.reason._tag),
      ]);

      return response;
    },
    // A pull fails only when the database does. The device's connection drops the call and
    // pulls again.
    Effect.catchTags({ SqlError: Effect.die }),
    (effect, _account, request) => Contract.failSendable(effect, request.contract, minimum),
    Effect.provide(services),
  );

  return Service.of({ pull });
});

export const layer = (minimum: Contract.Minimum) => Layer.effect(Service, make(minimum));
