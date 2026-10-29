/**
 * `Sync.push`: commands in mutation id order, each in its own transaction, whose first statement
 * bumps and locks the client's row (sync.md, section 2). A refusal still advances the last
 * mutation id, in a second transaction that records the reason. The batch stops at `Retry` or
 * `Stale`.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { CryptoSuite } from "@stu/e2ee";
import { SealedRow } from "@stu/e2ee";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlError from "effect/sql/SqlError";
import { Sync } from "../definition/Sync.ts";
import { Bounds } from "../protocol/Bounds.ts";
import { Command } from "../protocol/Command.ts";
import { Ids } from "../protocol/Ids.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import { Contract } from "./Contract.ts";
import { Decision } from "./Decision.ts";
import { MutateCommand } from "./MutateCommand.ts";
import type { Ports } from "./Ports.ts";
import { Pokes } from "./Pokes.ts";
import { SealCommand } from "./SealCommand.ts";
import { SyncEpoch } from "./SyncEpoch.ts";
import { SyncSchema } from "./SyncSchema.ts";

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

/** What the command log keeps of a `Mutate`: arguments a readable table's mutator decoded. */
const MutateDetail = Schema.Struct({ args: Schema.Json });

/**
 * What it keeps of a command it can't read safely: one naming no readable table's mutator, with
 * arguments that mutator doesn't decode, or past a bound. Such arguments may be anything, a
 * homework's title sent as a `Mutate` included, so only their size and hash stay.
 */
const OpaqueDetail = Schema.Struct({ bytes: Schema.Int, sha256: Schema.String });

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

const encodeOpaqueDetail = Schema.encodeEffect(Schema.fromJsonString(OpaqueDetail));

const encodeCommand = Schema.encodeEffect(Schema.fromJsonString(Schema.toCodecJson(Command.Any)));

const encodeCommandJson = Schema.encodeEffect(Schema.toCodecJson(Command.Any));

const utf8 = new TextEncoder();

/** The earliest and latest instants Postgres stores comfortably, years 1 to 9999. */
const earliest = DateTime.toEpochMillis(DateTime.makeUnsafe("0001-01-01T00:00:00Z"));

const latest = DateTime.toEpochMillis(DateTime.makeUnsafe("9999-12-31T23:59:59.999Z"));

/**
 * When the user acted, for the command log only. A device clock far off is clamped instead of
 * refused, because the time changes nothing else about the command.
 */
const loggedAt = (at: DateTime.Utc) =>
  DateTime.toDateUtc(
    DateTime.makeUnsafe(Math.min(latest, Math.max(earliest, DateTime.toEpochMillis(at)))),
  );

/** Postgres's SQLSTATE of a failed statement, such as `22021` for a byte sequence it rejects. */
const sqlState = (error: SqlError.SqlError) => {
  const { cause } = error.reason;

  return Predicate.hasProperty(cause, "code") && Predicate.isString(cause.code)
    ? cause.code
    : undefined;
};

/** A data exception: a value in the command that Postgres can't take, which no retry fixes. */
const isDataException = (error: unknown): error is SqlError.SqlError =>
  SqlError.isSqlError(error) && (sqlState(error)?.startsWith("22") ?? false);

/** The refusal for a command whose values Postgres rejected after `Bounds` let them through. */
const dataRefusal = (command: Command.Any) => {
  if (command._tag === "Mutate") {
    return new Refusal.InvalidArgs({ mutator: command.name, version: command.version });
  }

  const [write] = command.writes;
  const [box] = command.boxes;
  const [link] = command.links;

  const [space, id] =
    write !== undefined
      ? [write.space, write.id]
      : box !== undefined
        ? [box.space, Protocol.keyBoxId(box)]
        : link !== undefined
          ? [link.space, Protocol.historyLinkId(link)]
          : ["?", "?"];

  return new Refusal.BadEnvelope({ space, id });
};

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

interface Fingerprint {
  readonly bytes: number;
  readonly sha256: string;
}

/**
 * A command's size and SHA-256 as JSON, keys sorted where it can be stored, so a command sent again
 * matches however the device ordered its keys.
 */
const fingerprint = Effect.fn("Push.fingerprint")(function* (command: Command.Any) {
  const canonical = CanonicalJson.encode(yield* encodeCommandJson(command));
  const text = Result.isSuccess(canonical) ? canonical.success : yield* encodeCommand(command);
  const bytes = utf8.encode(text);

  return { bytes: bytes.length, sha256: bytesToHex(sha256(bytes)) } satisfies Fingerprint;
});

const sealDetail = (command: Command.Seal) =>
  encodeSealDetail({
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
  const definition = yield* SyncSchema.Service;

  const services = yield* Effect.context<
    SqlClient.SqlClient | SyncSchema.Service | Ports.AccountKeys | CryptoSuite.Service
  >();

  /**
   * What the command log keeps of a command: never content it can't read, and of a command past a
   * bound only its kind, size and hash, because its name or version may not fit the columns.
   */
  const loggedOf = Effect.fnUntraced(function* (command: Command.Any, print: Fingerprint) {
    const unnamed = { name: null, version: null };
    const opaque = encodeOpaqueDetail(print);

    if (Option.isSome(Bounds.refusalOf(command))) return { ...unnamed, detail: yield* opaque };

    if (command._tag === "Seal") return { ...unnamed, detail: yield* sealDetail(command) };
    const mutator = definition.byName.mutators.Mutate.get(command.name);

    const decodes =
      mutator !== undefined &&
      Result.isSuccess(yield* Effect.result(Sync.invoke(mutator, command.version, command.args)));

    return {
      name: command.name,
      version: command.version,
      detail: decodes ? yield* encodeMutateDetail({ args: command.args }) : yield* opaque,
    };
  });

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
    const print = yield* Effect.orDie(fingerprint(command));
    const { name, version, detail } = yield* Effect.orDie(loggedOf(command, print));
    const encodedReason = reason === null ? null : yield* Effect.orDie(encodeReason(reason));
    const processedAt = DateTime.toDateUtc(yield* DateTime.now);

    yield* sql`
        insert into command_log
          (client_id, mutation_id, account_id, kind, name, version, detail, sha256, applied,
            reason, at, processed_at)
        values (
          ${client}, ${command.mutationId}, ${account}, ${command._tag}, ${name},
          ${version}::int, ${detail}::jsonb, ${print.sha256}, ${reason === null},
          ${encodedReason}::jsonb, ${loggedAt(command.at)}, ${processedAt}
        )
      `;
  });

  /** What the command log says about a command processed before. */
  const earlier = Effect.fn("Push.earlier")(function* (client: string, command: Command.Any) {
    const { mutationId } = command;

    const [row] = yield* sql<{ readonly reason: string | null; readonly sha256: string | null }>`
        select reason::text as reason, sha256 from command_log
        where client_id = ${client} and mutation_id = ${mutationId}
      `;

    // A device whose database went back in time made a new command under an id it had used.
    if (row !== undefined && row.sha256 !== null) {
      const { sha256: sent } = yield* Effect.orDie(fingerprint(command));

      if (sent !== row.sha256) return yield* new Protocol.ClientUnknown();
    }

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
        const bound = Bounds.refusalOf(command);

        if (Option.isSome(bound)) {
          return yield* new Declined({ decision: yield* Decision.refuse(bound.value) });
        }

        const decided: Effect.Effect<
          Decision.Decision,
          SqlError.SqlError,
          SqlClient.SqlClient | SyncSchema.Service | Ports.AccountKeys | CryptoSuite.Service
        > =
          command._tag === "Mutate"
            ? MutateCommand.decide(account, command)
            : SealCommand.decide(account, client, command);

        const decision = yield* Effect.catchIf(decided, isDataException, () =>
          Decision.refuse(dataRefusal(command)),
        );

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
    (client: string, command: Command.Any) =>
    ({ why }: Unclaimed) =>
      why === "duplicate"
        ? earlier(client, command)
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
            Effect.catchTags({ "Push.Unclaimed": unclaimed(client, command) }),
          );
        case "Retry":
          return Effect.succeed(Protocol.Retry.make({ mutationId }));
        case "Stale":
          return Effect.succeed(Protocol.Stale.make({ mutationId }));
      }
    };

    return attempts(apply(client, account, command), mutationId).pipe(
      Effect.catchTags({
        "Push.Unclaimed": unclaimed(client, command),
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
    (effect, _account, request) => Contract.failSendable(effect, request.contract, minimum),
    Effect.provide(services),
  );

  return Service.of({ push });
});

export const layer = (minimum: Contract.Minimum) => Layer.effect(Service, make(minimum));
