/**
 * How an encrypted command leaves the device. Each run keeps the command's rows as drafts with the
 * base they were computed from, and only the push seals them, under the space's current key epoch.
 * A notebook without an epoch gets epoch 0, a key the device makes and boxes to its own account.
 */
import { CryptoSuite, SealedRow, SpaceKey } from "@stu/e2ee";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import { Command } from "../protocol/Command.ts";
import { Keyring } from "./Keyring.ts";
import type { Outbox } from "./Outbox.ts";
import type { SqliteTx } from "./SqliteTx.ts";

export * as Sealing from "./Sealing.ts";

const encoder = new TextEncoder();

/** AES-GCM's nonce before the ciphertext and its tag after. */
const overhead = 12 + 16;

/** Whether the draft's ciphertext would exceed what the server stores (`Sync.TooLarge`). */
export const tooLarge = (draft: Outbox.Draft) =>
  draft.data !== null &&
  overhead +
    SealedRow.paddedLength(
      4 + encoder.encode(draft.table).length + encoder.encode(draft.data).length,
    ) >
    Command.maxSealedBytes;

/**
 * The rows a run wrote, as drafts. `writer` names the waiting command that last wrote a row, so a
 * batch can write one row twice before the server confirmed the first.
 */
export const drafts = Effect.fnUntraced(function* <E, R>(
  written: ReadonlyArray<SqliteTx.Written>,
  writer: (space: string, id: string) => Effect.Effect<Option.Option<number>, E, R>,
) {
  const sql = yield* SqlClient.SqlClient;
  const result: Array<Outbox.Draft> = [];

  for (const row of written) {
    const [pending] = yield* sql<{ readonly data: string | null }>`
      select data from pending_row where space = ${row.space} and tbl = ${row.table} and id = ${row.id}
    `;

    const [stored] = yield* sql<{ readonly version: number }>`
      select version from sync_sealed_row where space = ${row.space} and id = ${row.id}
    `;

    const earlier = yield* writer(row.space, row.id);

    const base = Option.isSome(earlier)
      ? Command.AfterMutation.make({ mutationId: earlier.value })
      : stored === undefined
        ? Command.Absent.make({})
        : Command.AtVersion.make({ version: stored.version });

    result.push({ ...row, data: pending?.data ?? null, base });
  }

  return result;
});

/** Why a sealed command can't go out yet. The push stops before it, and the round retries. */
export type Blocked = "locked" | "key-missing";

/**
 * Seals a command's drafts for the push. `opening` holds the spaces this batch already opens epoch
 * 0 in, so only the first command that writes there carries the box.
 */
export const seal = Effect.fnUntraced(function* (
  command: Outbox.Command,
  actor: string,
  keyring: Keyring.Keyring,
  opening: Set<string>,
) {
  const sql = yield* SqlClient.SqlClient;
  const writes: Array<Command.SealedWrite> = [];
  const boxes: Array<SpaceKey.KeyBox> = [];
  const at = DateTime.makeUnsafe(command.at);

  // A command whose last run refused leaves without rows: its id is used, and the device shows
  // its own reason once the id settles.
  const drafts = command.failure === null ? (command.writes ?? []) : [];

  for (const draft of drafts) {
    const [space] = yield* sql<{ readonly key_epoch: number | null }>`
      select key_epoch from sync_space where id = ${draft.space}
    `;

    const epoch = space?.key_epoch ?? 0;
    const opened = space !== undefined && space.key_epoch !== null;
    const stored = yield* Keyring.spaceKey(draft.space, epoch);

    if (opened && Option.isNone(stored)) return "key-missing" satisfies Blocked;

    // Epoch 0 of a notebook nobody wrote yet: the device's own key, boxed to its own account, so a
    // locked device makes none. It keeps the key before it leaves, so a resent command seals under
    // the same key.
    const account = opened ? Option.none<Keyring.Account>() : yield* keyring.account;

    if (!opened && Option.isNone(account)) return "locked" satisfies Blocked;

    const key = Option.isSome(stored) ? stored.value : yield* SpaceKey.generate;

    if (Option.isSome(account)) {
      if (Option.isNone(stored)) yield* Keyring.storeKeys(draft.space, [{ epoch: 0, key }]);

      if (!opening.has(draft.space)) {
        boxes.push(
          yield* SpaceKey.box(
            draft.space,
            [{ epoch: 0, key }],
            account.value.record,
            account.value.keys,
          ).pipe(Effect.orDie),
        );
        opening.add(draft.space);
      }
    }

    const sealed =
      draft.data === null
        ? {
            envelope: new SealedRow.Envelope({
              format: SealedRow.format,
              suite: CryptoSuite.id,
              keyEpoch: epoch,
              author: actor,
            }),
            ct: null,
          }
        : yield* SealedRow.seal(
            { space: draft.space, id: draft.id, table: draft.table, json: draft.data },
            actor,
            epoch,
            key,
          ).pipe(Effect.orDie);

    writes.push({ space: draft.space, id: draft.id, base: draft.base, ...sealed });
  }

  return Command.Seal.make({ mutationId: command.mutationId, at, writes, boxes, links: [] });
});
