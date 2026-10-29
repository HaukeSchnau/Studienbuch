/**
 * One round of sync over a connection: push the outbox from the first command the server hasn't
 * confirmed, then pull every page, each applied in one transaction that also settles the outbox
 * and replays what still waits. The supervisor runs a round after each connect and after pokes,
 * one at a time.
 */
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type * as SqlError from "effect/sql/SqlError";
import type { Sync } from "../definition/Sync.ts";
import { Ids } from "../protocol/Ids.ts";
import type { Protocol } from "../protocol/Protocol.ts";
import { DeviceSchema } from "./DeviceSchema.ts";
import { Outbox } from "./Outbox.ts";
import { Rebase } from "./Rebase.ts";

export * as Replication from "./Replication.ts";

/** The connection dropped, or a response never came. The supervisor reconnects. */
export class Disconnected extends Schema.TaggedError<
  Disconnected,
  { readonly brand: unique symbol }
>()("SyncClient.Disconnected", {}) {}

/**
 * The server needs a newer app. `minimum` names the versions when the server said so in an error;
 * a socket closed with 4426 says only that this app is too old.
 */
export interface UpdateRequired {
  readonly minimum: Option.Option<{ readonly protocol: number; readonly schema: number }>;
}

/** The two calls of one connection. */
export interface Remote {
  readonly push: (
    request: Protocol.PushRequest,
  ) => Effect.Effect<Protocol.PushResponse, typeof Protocol.PushError.Type | Disconnected>;
  readonly pull: (
    request: Protocol.PullRequest,
  ) => Effect.Effect<Protocol.PullResponse, typeof Protocol.PullError.Type | Disconnected>;
}

/**
 * How a round ended. `retry`: the server answered `Retry`, or `Stale` kept coming, so the
 * supervisor waits and runs another round. `update-required` and `revoked` stop syncing.
 */
export type Outcome = "idle" | "retry" | "update-required" | "revoked";

/** Commands per push. */
export const pushBatch = 100;

/** Rows per pull page. */
export const pageRows = 1_000;

/** Rounds of push and pull before a round gives up and waits, when `Stale` keeps coming. */
const maxPasses = 8;

/** What the engine does around a round's transactions. */
export interface Device {
  readonly definition: Sync.Definition;
  readonly actor: string;
  /** Updates the engine's status while a round runs. */
  readonly report: (
    change: Partial<{
      readonly pushing: boolean;
      readonly pulling: boolean;
      readonly updateRequired: Option.Option<UpdateRequired>;
    }>,
  ) => Effect.Effect<void>;
  /** Runs `effect` in one transaction, then invalidates the tables it reports. */
  readonly commit: <A extends { readonly tables: Iterable<string> }, E>(
    effect: Effect.Effect<A, E, SqlClient.SqlClient>,
  ) => Effect.Effect<A, E | SqlError.SqlError>;
  /** After a commit that settled commands: completes their `confirmed` handles. */
  readonly settled: (settled: Outbox.Settled) => Effect.Effect<void>;
  /** After a commit that gave the outbox a new client id: each command's new id by its old one. */
  readonly renumbered: (renumbered: Renumbered) => Effect.Effect<void>;
  /** Wipes the device: data, outbox and keys. */
  readonly wipe: Effect.Effect<void, SqlError.SqlError>;
}

export interface Renumbered {
  readonly from: string;
  readonly to: string;
  readonly ids: ReadonlyMap<number, number>;
}

type Step =
  | "done"
  | "again"
  | "stale"
  | "retry"
  | "revoked?"
  | "renumber-after-pull"
  | Exclude<Outcome, "idle" | "retry">;

export const make = (device: Device) => {
  const { definition, actor } = device;

  /** Reports `key` while `effect` runs, so a pull's flag also covers applying its pages. */
  const flagged = <A, E, R>(key: "pushing" | "pulling", effect: Effect.Effect<A, E, R>) =>
    Effect.andThen(
      device.report({ [key]: true }),
      Effect.ensuring(effect, device.report({ [key]: false })),
    );

  const updateRequired = (minimum: { readonly protocol: number; readonly schema: number }) =>
    Effect.as(
      device.report({ updateRequired: Option.some({ minimum: Option.some(minimum) }) }),
      "update-required" as const,
    );

  /** Gives the outbox a new client id, numbered again from 1, inside the caller's transaction. */
  const renumberTo = Effect.fnUntraced(function* (to: string) {
    const { clientId: from } = yield* Outbox.meta;

    return { from, to, ids: yield* Outbox.renumber(to) } satisfies Renumbered;
  });

  /** A new client id for an outbox the server can't place under the old one. */
  const renumber = Effect.gen(function* () {
    const to = yield* Ids.random;

    const { renumbered } = yield* device.commit(
      Effect.map(renumberTo(to), (renumbered) => ({
        renumbered,
        tables: [DeviceSchema.keys.outbox],
      })),
    );

    yield* device.renumbered(renumbered);
  });

  /**
   * The server's database came back from a backup (`sync.md` section 1). Every space comes back
   * whole with the next pull, and the screens keep their rows until then. When the device's
   * commands after the server's `lastMutationId` have a hole, as a refused command leaves, they
   * move to a new client id before anything is pushed.
   */
  const recover = Effect.fnUntraced(function* (changed: Protocol.EpochChanged) {
    const to = yield* Ids.random;

    const { renumbered } = yield* device.commit(
      Effect.gen(function* () {
        yield* Rebase.forgetCursors;
        const gapless = yield* Outbox.restore(changed.lastMutationId, changed.syncEpoch);
        const renumbered = gapless ? Option.none() : Option.some(yield* renumberTo(to));
        const replayed = yield* Rebase.replay(definition, actor);
        yield* Outbox.setReplayDue(false);

        return {
          renumbered,
          tables: [...replayed, DeviceSchema.keys.outbox, DeviceSchema.keys.spaces],
        };
      }),
    );

    if (Option.isSome(renumbered)) yield* device.renumbered(renumbered.value);
  });

  /**
   * Sends the outbox from `fence.pushedUpTo` on, a batch at a time. After any failure the next
   * round starts again at the first command the device hasn't settled, and sends nothing newer
   * than what the server confirms.
   */
  const push = Effect.fnUntraced(function* (remote: Remote, fence: { pushedUpTo: number }) {
    for (;;) {
      const meta = yield* Outbox.meta;
      const waiting = yield* Outbox.after(fence.pushedUpTo, pushBatch);
      const firstSeal = waiting.findIndex((command) => command.mode === "Seal");
      const sendable = firstSeal === -1 ? waiting : waiting.slice(0, firstSeal);

      if (sendable.length === 0) return waiting.length === 0 ? "done" : "retry";

      const result = yield* Effect.result(
        remote.push({
          clientId: meta.clientId,
          syncEpoch: meta.syncEpoch,
          contract: definition.contract,
          commands: sendable.map(Outbox.asMutate),
        }),
      );

      if (Result.isFailure(result)) {
        const error = result.failure;

        switch (error._tag) {
          case "SyncClient.Disconnected":
            return yield* error;
          case "Sync.OutOfOrder": {
            const [next] = yield* Outbox.after(error.expected - 1, 1);

            // The server waits for a command the device no longer holds: settle what it applied
            // under this client id, then give the rest a new one.
            if (next?.mutationId !== error.expected) return "renumber-after-pull";

            // An answer that moves nothing would send the same batch forever.
            if (fence.pushedUpTo === error.expected - 1) return "retry";
            fence.pushedUpTo = error.expected - 1;
            continue;
          }

          case "Sync.EpochChanged":
            yield* recover(error);

            return "again";
          case "Sync.ClientUnknown":
            yield* renumber;

            return "again";
          case "Sync.UpdateRequired":
            return yield* updateRequired(error.minimum);
          case "Sync.DeviceRevoked":
            return "revoked?";
        }
      }

      const response = result.success;

      // The server counts more commands for this client id than the device ever made, as when a
      // copy of the device's database runs elsewhere. None of the device's own were applied.
      if (response.lastMutationId > meta.lastMutationId) {
        yield* renumber;

        return "again";
      }

      if (response.outcomes.some((outcome) => outcome._tag === "Retry")) return "retry";

      if (response.outcomes.some((outcome) => outcome._tag === "Stale")) return "stale";

      if (response.lastMutationId <= fence.pushedUpTo) return "retry";
      fence.pushedUpTo = response.lastMutationId;
    }
  });

  /**
   * Applies one page in one transaction: the spaces and base rows, and on the last page the
   * settled commands and a replay of the rest, when this page or one before changed something.
   * `replay_due` carries that across pages, and across a pull that a drop or a crash cut short.
   */
  const apply = Effect.fnUntraced(function* (response: Protocol.PullResponse) {
    const now = yield* Clock.currentTimeMillis;
    const to = yield* Ids.random;

    const result = yield* device.commit(
      Effect.gen(function* () {
        const meta = yield* Outbox.meta;
        yield* Outbox.setSyncEpoch(response.syncEpoch);
        const tables = yield* Rebase.applyPull(response, now);
        const last = response.lastMutationId;

        // Only the last page carries a last mutation id. One above the device's own means the
        // server counts another device's commands under this id, so the outbox moves on.
        const ahead = last !== null && last > meta.lastMutationId;
        const renumbered = ahead ? Option.some(yield* renumberTo(to)) : Option.none();

        const settled =
          last === null || ahead
            ? Option.none<Outbox.Settled>()
            : Option.some(yield* Outbox.settle(last, response.refusals, now));

        const refused = Option.exists(settled, (each) => each.refused.length > 0);

        const changed =
          meta.replayDue ||
          tables.size > 0 ||
          Option.isSome(renumbered) ||
          Option.exists(settled, (each) => each.applied.length > 0) ||
          refused;

        const replayed = changed && !response.more ? yield* Rebase.replay(definition, actor) : [];
        yield* Outbox.setReplayDue(changed && response.more);

        return {
          settled,
          renumbered,
          tables: [
            ...tables,
            ...replayed,
            DeviceSchema.keys.spaces,
            DeviceSchema.keys.outbox,
            ...(refused ? [DeviceSchema.keys.refusals] : []),
          ],
        };
      }),
    );

    if (Option.isSome(result.renumbered)) yield* device.renumbered(result.renumbered.value);

    if (Option.isSome(result.settled)) yield* device.settled(result.settled.value);
  });

  /** Replays the outbox when a page changed base rows and no replay followed, as after a cut. */
  const replayIfDue = Effect.gen(function* () {
    if (!(yield* Outbox.meta).replayDue) return;

    yield* device.commit(
      Effect.gen(function* () {
        const tables = yield* Rebase.replay(definition, actor);
        yield* Outbox.setReplayDue(false);

        return { tables };
      }),
    );
  });

  const cursors = Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    return yield* sql<{ readonly space: string; readonly version: number }>`
      select id as space, version from sync_space where version is not null order by id
    `;
  });

  const pull = Effect.fnUntraced(function* (remote: Remote) {
    for (;;) {
      const meta = yield* Outbox.meta;
      const before = yield* cursors;

      const result = yield* Effect.result(
        remote.pull({
          clientId: meta.clientId,
          syncEpoch: meta.syncEpoch,
          contract: definition.contract,
          cursors: before,
          settledMutationId: meta.settledMutationId,
          limit: pageRows,
        }),
      );

      if (Result.isFailure(result)) {
        const error = result.failure;

        // Pages before the cut changed base rows: the screens get a replay on them now.
        yield* replayIfDue;

        switch (error._tag) {
          case "SyncClient.Disconnected":
            return yield* error;
          case "Sync.EpochChanged":
            yield* recover(error);

            return "again";
          case "Sync.ClientUnknown":
            yield* renumber;

            return "again";
          case "Sync.UpdateRequired":
            return yield* updateRequired(error.minimum);
          case "Sync.DeviceRevoked":
            yield* device.wipe;

            return "revoked";
        }
      }

      yield* apply(result.success);

      if (!result.success.more) return "done";

      // Another page that moves no cursor would be asked for forever.
      const moved = new Map(before.map((cursor) => [cursor.space, cursor.version]));
      const after = yield* cursors;

      if (
        after.length === before.length &&
        after.every((cursor) => moved.get(cursor.space) === cursor.version)
      ) {
        return "retry";
      }
    }
  });

  /** One round over `remote`. Fails only when the connection does. */
  const round = Effect.fnUntraced(function* (remote: Remote) {
    for (let pass = 0; pass < maxPasses; pass++) {
      const fence = { pushedUpTo: (yield* Outbox.meta).settledMutationId };
      const pushed: Step = yield* flagged("pushing", push(remote, fence));

      if (pushed === "update-required") return pushed;

      if (pushed === "again") continue;

      const pulled: Step = yield* flagged("pulling", pull(remote));

      if (pulled === "update-required" || pulled === "revoked") return pulled;

      if (pulled === "again") continue;

      if (pushed === "renumber-after-pull") {
        if (pulled === "retry") return "retry";
        yield* renumber;
        continue;
      }

      if (pushed === "stale") continue;

      if (pushed === "retry" || pushed === "revoked?" || pulled === "retry") return "retry";

      // A command that arrived during the round goes out in the next pass.
      if ((yield* Outbox.after(fence.pushedUpTo, 1)).length === 0) return "idle";
    }

    return "retry";
  });

  return { round, replayIfDue } as const;
};
