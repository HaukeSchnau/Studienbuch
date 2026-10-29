/**
 * `Sync.push`: commands in mutation id order, each in its own transaction, whose first statement
 * bumps and locks the client's row (sync.md, section 2). A refusal still advances the last
 * mutation id, in a second transaction that records the reason. The batch stops at `Retry` or
 * `Stale`.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { SealedRow } from "@stu/e2ee";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlError from "effect/sql/SqlError";
import { Command } from "../protocol/Command.ts";
import { Ids } from "../protocol/Ids.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { Contract } from "./Contract.ts";
import type { Decision } from "./Decision.ts";
import { MutateCommand } from "./MutateCommand.ts";
import { Pokes } from "./Pokes.ts";
import { SealCommand } from "./SealCommand.ts";
import { SyncEpoch } from "./SyncEpoch.ts";
import type { SyncSchema } from "./SyncSchema.ts";

export * as Push from "./Push.ts";

export class Service extends Context.Service<
  Service,
  {
    /** Runs a push for the connection's account. */
    readonly push: (
      account: string,
      request: Protocol.PushRequest,
    ) => Effect.Effect<Protocol.PushResponse, typeof Protocol.PushError.Type>;
  }
>()("@stu/sync/server/Push") {}

/** What the command log keeps of a `Mutate`: the arguments, which only readable tables take. */
const MutateDetail = Schema.Struct({ args: Schema.Json });

/** What it keeps of a `Seal`: what the server checked, and a hash of each ciphertext. */
const SealDetail = Schema.Struct({
  writes: Schema.Array(
    Schema.Struct({
      space: Ids.Id,
      id: Ids.Id,
      base: Command.Base,
      envelope: SealedRow.Envelope,
      bytes: Schema.NullOr(Schema.Int),
      sha256: Schema.NullOr(Schema.String),
    }),
  ),
  keys: Schema.Array(Schema.Struct({ space: Ids.Id, tbl: Schema.String, id: Schema.String })),
});

const encodeMutateDetail = Schema.encodeEffect(Schema.fromJsonString(MutateDetail));

const encodeSealDetail = Schema.encodeEffect(Schema.fromJsonString(Schema.toCodecJson(SealDetail)));

const ReasonJson = Schema.fromJsonString(Refusal.Reason);

const encodeReason = Schema.encodeEffect(ReasonJson);

const decodeReason = Schema.decodeEffect(ReasonJson);

/** A transaction couldn't take the command's mutation id, and rolls back. */
class Unclaimed extends Data.TaggedError("Push.Unclaimed")<{
  readonly why: "duplicate" | "client-unknown" | { readonly expected: number };
}> {}

/** The command isn't applied, so its transaction rolls back. */
class Declined extends Data.TaggedError("Push.Declined")<{
  readonly decision: Exclude<Decision.Decision, { readonly _tag: "Applied" }>;
}> {}

const detailOf = (command: Command.Any) =>
  command._tag === "Mutate"
    ? encodeMutateDetail({ args: command.args })
    : encodeSealDetail({
        writes: command.writes.map((write) => ({
          space: write.space,
          id: write.id,
          base: write.base,
          envelope: write.envelope,
          bytes: write.ct === null ? null : write.ct.length,
          sha256: write.ct === null ? null : bytesToHex(sha256(write.ct)),
        })),
        keys: [
          ...command.boxes.map((box) => ({
            space: box.space,
            tbl: Protocol.keyBoxTable,
            id: Protocol.keyBoxId(box),
          })),
          ...command.links.map((link) => ({
            space: link.space,
            tbl: Protocol.historyLinkTable,
            id: Protocol.historyLinkId(link),
          })),
        ],
      });

export const make = Effect.fn("Push.make")(function* (minimum: Contract.Minimum) {
  const sql = yield* SqlClient.SqlClient;
  const services = yield* Effect.context<SqlClient.SqlClient | SyncSchema.Service>();

  const clientRow = Effect.fn("Push.clientRow")(function* (client: string) {
    const [row] = yield* sql<{ readonly account: string; readonly lastMutationId: number }>`
        select account_id as account, last_mutation_id::float8 as "lastMutationId"
        from sync_client where id = ${client}
      `;

    return row;
  });

  /** Takes the command's mutation id for this transaction, registering a new client. */
  const claim = Effect.fn("Push.claim")(function* (
    client: string,
    account: string,
    command: Command.Any,
  ) {
    const [bumped] = yield* sql<{
      readonly account: string;
      readonly lastMutationId: number;
      readonly inserted: boolean;
    }>`
        insert into sync_client (id, account_id, last_mutation_id) values (${client}, ${account}, 1)
        on conflict (id) do update set last_mutation_id = sync_client.last_mutation_id + 1
        returning account_id as account, last_mutation_id::float8 as "lastMutationId",
          (xmax = 0) as inserted
      `;

    if (bumped === undefined) return yield* Effect.die("The client bump returned no row");

    // Another account registered the id, or the server forgot a client whose commands it applied.
    if (bumped.account !== account || (bumped.inserted && command.mutationId > 1)) {
      return yield* new Unclaimed({ why: "client-unknown" });
    }

    if (command.mutationId < bumped.lastMutationId) {
      return yield* new Unclaimed({ why: "duplicate" });
    }

    if (command.mutationId > bumped.lastMutationId) {
      return yield* new Unclaimed({ why: { expected: bumped.lastMutationId } });
    }
  });

  const log = Effect.fn("Push.log")(function* (
    client: string,
    account: string,
    command: Command.Any,
    reason: Refusal.Reason | null,
  ) {
    const detail = yield* Effect.orDie(detailOf(command));
    const encodedReason = reason === null ? null : yield* Effect.orDie(encodeReason(reason));
    const processedAt = DateTime.toDateUtc(yield* DateTime.now);
    const mutator = command._tag === "Mutate" ? command : { name: null, version: null };

    yield* sql`
        insert into command_log
          (client_id, mutation_id, account_id, kind, name, version, detail, applied, reason, at,
            processed_at)
        values (
          ${client}, ${command.mutationId}, ${account}, ${command._tag}, ${mutator.name},
          ${mutator.version}::int, ${detail}::jsonb, ${reason === null}, ${encodedReason}::jsonb,
          ${DateTime.toDateUtc(command.at)}, ${processedAt}
        )
      `;
  });

  /** What the command log says about a command processed before. */
  const earlier = Effect.fn("Push.earlier")(function* (client: string, mutationId: number) {
    const [row] = yield* sql<{ readonly reason: string | null }>`
        select reason::text as reason from command_log
        where client_id = ${client} and mutation_id = ${mutationId}
      `;

    if (row?.reason === undefined || row.reason === null) {
      return Protocol.Applied.make({ mutationId });
    }

    const reason = yield* Effect.orDie(decodeReason(row.reason));

    return Protocol.Rejected.make({ mutationId, reason });
  });

  /** Applies the command in one transaction, or rolls it back with why not. */
  const apply = (client: string, account: string, command: Command.Any) =>
    sql.withTransaction(
      Effect.gen(function* () {
        yield* claim(client, account, command);

        const decision =
          command._tag === "Mutate"
            ? yield* MutateCommand.decide(account, command)
            : yield* SealCommand.decide(account, client, command);

        if (decision._tag !== "Applied") return yield* new Declined({ decision });
        yield* log(client, account, command, null);
        yield* Pokes.notify({ spaces: decision.spaces, accounts: decision.accounts });

        return Protocol.Applied.make({ mutationId: command.mutationId });
      }),
    );

  /** Records a refusal in a transaction of its own, which advances the last mutation id. */
  const refuse = (client: string, account: string, command: Command.Any, reason: Refusal.Reason) =>
    sql.withTransaction(
      Effect.andThen(
        claim(client, account, command),
        Effect.as(
          log(client, account, command, reason),
          Protocol.Rejected.make({ mutationId: command.mutationId, reason }),
        ),
      ),
    );

  /** Answers a command whose mutation id the transaction couldn't take. */
  const unclaimed =
    (client: string, mutationId: number) =>
    ({ why }: Unclaimed) =>
      why === "duplicate"
        ? earlier(client, mutationId)
        : why === "client-unknown"
          ? Effect.fail(new Protocol.ClientUnknown())
          : Effect.fail(new Protocol.OutOfOrder({ expected: why.expected }));

  /** A deadlock or a dropped connection is tried three times, then answered `Retry`. */
  const attempts = <A, E, R>(
    effect: Effect.Effect<A, E | SqlError.SqlError, R>,
    mutationId: number,
  ) =>
    effect.pipe(
      Effect.retry({ times: 2, while: SqlError.isSqlError }),
      Effect.catchIf(SqlError.isSqlError, (error) =>
        Effect.as(
          Effect.logWarning("A command waits for the database").pipe(
            Effect.annotateLogs({ reason: error.reason._tag }),
          ),
          Protocol.Retry.make({ mutationId }),
        ),
      ),
    );

  const process = (client: string, account: string, command: Command.Any) => {
    const { mutationId } = command;

    const declined = ({ decision }: Declined) => {
      switch (decision._tag) {
        case "Refused":
          return attempts(refuse(client, account, command, decision.reason), mutationId).pipe(
            // Another connection of the device may have recorded the command meanwhile.
            Effect.catchTags({ "Push.Unclaimed": unclaimed(client, mutationId) }),
          );
        case "Retry":
          return Effect.succeed(Protocol.Retry.make({ mutationId }));
        case "Stale":
          return Effect.succeed(Protocol.Stale.make({ mutationId }));
      }
    };

    return attempts(apply(client, account, command), mutationId).pipe(
      Effect.catchTags({
        "Push.Unclaimed": unclaimed(client, mutationId),
        "Push.Declined": declined,
      }),
      Effect.withSpan("Push.process", { attributes: { mutationId, kind: command._tag } }),
    );
  };

  const push = Effect.fn("Push.push")(
    function* (account: string, request: Protocol.PushRequest) {
      yield* Contract.admit(request.contract, minimum);
      const known = yield* clientRow(request.clientId);

      if (known !== undefined && known.account !== account) {
        return yield* new Protocol.ClientUnknown();
      }

      const syncEpoch = yield* SyncEpoch.current;

      if (request.syncEpoch !== null && request.syncEpoch !== syncEpoch) {
        const lastMutationId = known?.lastMutationId ?? 0;

        return yield* new Protocol.EpochChanged({ syncEpoch, lastMutationId });
      }

      const outcomes: Array<Protocol.Outcome> = [];

      for (const command of request.commands) {
        const outcome = yield* process(request.clientId, account, command);
        outcomes.push(outcome);

        if (outcome._tag === "Retry" || outcome._tag === "Stale") break;
      }

      const lastMutationId = (yield* clientRow(request.clientId))?.lastMutationId ?? 0;

      yield* Contract.sendable(
        request.contract,
        minimum,
        outcomes.flatMap((outcome) =>
          outcome._tag === "Rejected" ? [outcome._tag, outcome.reason._tag] : [outcome._tag],
        ),
      );

      return { lastMutationId, outcomes } satisfies Protocol.PushResponse;
    },
    // Reads outside a command's transaction fail only when the database does. The device's
    // connection drops the call and pushes again.
    Effect.catchTags({ SqlError: Effect.die }),
    Effect.provide(services),
  );

  return Service.of({ push });
});

export const layer = (minimum: Contract.Minimum) => Layer.effect(Service, make(minimum));
