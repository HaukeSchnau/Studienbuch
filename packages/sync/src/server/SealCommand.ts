/**
 * An encrypted table's command on the server, which can't read its rows. It checks what it can
 * see in the order of encryption.md section 4 (`Sync.NotMember`, `Sync.NotAllowed`, `Stale` for
 * the key epoch and each base, `Sync.BadEnvelope`, `Sync.TooLarge`) and stores what came.
 */
import { CryptoSuite, SealedRow, SpaceKey } from "@stu/e2ee";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Command } from "../protocol/Command.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { Decision } from "./Decision.ts";
import { SyncSchema } from "./SyncSchema.ts";

export * as SealCommand from "./SealCommand.ts";

/** The table of a sealed row, which only the device sees. */
export const sealedTable = "";

const encodeEnvelope = Schema.encodeEffect(
  Schema.fromJsonString(Schema.toCodecJson(SealedRow.Envelope)),
);

const encodeBox = Schema.encodeEffect(Schema.fromJsonString(Schema.toCodecJson(SpaceKey.KeyBox)));

const encodeLink = Schema.encodeEffect(
  Schema.fromJsonString(Schema.toCodecJson(SpaceKey.HistoryLink)),
);

/** A sealed row as the base check sees it. */
interface Stored {
  readonly version: number;
  readonly live: boolean;
  readonly writtenByClient: string | null;
  readonly writtenByMutation: number | null;
}

const matches = (base: Command.Base, stored: Stored | undefined, client: string) => {
  switch (base._tag) {
    case "AtVersion":
      return stored !== undefined && stored.live && stored.version === base.version;
    case "Absent":
      return stored === undefined || !stored.live;
    case "AfterMutation":
      return stored?.writtenByClient === client && stored.writtenByMutation === base.mutationId;
  }
};

const knownFormat = (item: { readonly format: number; readonly suite: number }, format: number) =>
  item.format === format && item.suite === CryptoSuite.id;

/**
 * Boxes and links carry Ed25519 signatures by their author's identity key at `authorGeneration`.
 * Checking them needs WP-2's verification and WP-11's account key records. Until both land the
 * server finds no box or link whose signature fails, and a device checks a box's signature before
 * it opens it.
 */
const unsigned = (
  _command: Command.Seal,
): Effect.Effect<Option.Option<{ readonly space: string; readonly id: string }>> =>
  Effect.succeedNone;

/** The rows a command writes into a space. */
interface Put {
  readonly space: string;
  readonly tbl: string;
  readonly id: string;
  readonly data: string | null;
  readonly envelope: string | null;
  readonly ct: Uint8Array | null;
}

export const decide = Effect.fn("SealCommand.decide")(function* (
  account: string,
  client: string,
  command: Command.Seal,
) {
  const sql = yield* SqlClient.SqlClient;
  const definition = yield* SyncSchema.Service;
  const { writes, boxes, links } = command;

  const authored = [
    ...writes.map((write) => ({ space: write.space, author: write.envelope.author })),
    ...boxes,
    ...links,
  ];

  // The device sends an empty Seal to use up the id of a command whose replay failed there.
  if (authored.length === 0) return Decision.Applied({ spaces: [], accounts: [] });
  const foreign = authored.find((item) => item.author !== account);

  if (foreign !== undefined) {
    return yield* Decision.refuse(new Refusal.NotMember({ space: foreign.space }));
  }

  const spaces = [...new Set(authored.map((item) => item.space))].sort();
  const locked = yield* Decision.lock(account, spaces);
  const epochs = new Map<string, number>();

  for (const space of spaces) {
    const held = locked.get(space);

    if (held?.role === undefined || held.role === null) {
      return yield* Decision.refuse(new Refusal.NotMember({ space }));
    }

    if (
      held.kind.encryption !== "sealed" ||
      !SyncSchema.sealedWriters(definition, held.kind.name).has(held.role)
    ) {
      return yield* Decision.refuse(new Refusal.NotAllowed({ space }));
    }
  }

  for (const space of spaces) {
    const current = locked.get(space)?.keyEpoch ?? null;
    const opening = [...boxes, ...links].filter((item) => item.space === space);

    if (opening.length === 0) {
      if (current !== null) epochs.set(space, current);
      continue;
    }

    const next = current === null ? 0 : current + 1;

    const members = yield* sql<{ readonly account: string }>`
      select account_id as account from space_member where space_id = ${space}
      order by account_id
    `;

    const recipients = boxes.flatMap((box) => (box.space === space ? [box.recipient] : [])).sort();

    // The epoch is open already, or a member joined or left since the device sealed the boxes.
    if (
      opening.some((item) => item.keyEpoch !== next) ||
      recipients.join("\n") !== members.map((member) => member.account).join("\n")
    ) {
      return Decision.Stale();
    }

    epochs.set(space, next);
  }

  for (const write of writes) {
    if (epochs.get(write.space) !== write.envelope.keyEpoch) return Decision.Stale();

    const [stored] = yield* sql<Stored>`
      select version::float8 as version, ct is not null as live,
        written_by_client as "writtenByClient", written_by_mutation::float8 as "writtenByMutation"
      from sync_row where space_id = ${write.space} and tbl = ${sealedTable} and id = ${write.id}
    `;

    if (!matches(write.base, stored, client)) return Decision.Stale();
  }

  // `Sync.Locked` checks a teacher's confirmation lock here, once confirmations exist.

  const unknown =
    writes.find((write) => !knownFormat(write.envelope, SealedRow.format)) ??
    boxes.flatMap((box) =>
      knownFormat(box, SpaceKey.format) ? [] : [{ space: box.space, id: Protocol.keyBoxId(box) }],
    )[0] ??
    links.flatMap((link) =>
      knownFormat(link, SpaceKey.format)
        ? []
        : [{ space: link.space, id: Protocol.historyLinkId(link) }],
    )[0];

  if (unknown !== undefined) {
    return yield* Decision.refuse(
      new Refusal.BadEnvelope({ space: unknown.space, id: unknown.id }),
    );
  }

  const forged = yield* unsigned(command);

  if (Option.isSome(forged)) {
    return yield* Decision.refuse(new Refusal.BadEnvelope(forged.value));
  }

  const large = writes.find((write) => (write.ct?.length ?? 0) > Command.maxSealedBytes);

  if (large !== undefined) {
    return yield* Decision.refuse(new Refusal.TooLarge({ space: large.space, id: large.id }));
  }

  const puts: Array<Put> = [];

  for (const box of boxes) {
    const data = yield* Effect.orDie(encodeBox(box));
    const id = Protocol.keyBoxId(box);
    puts.push({ space: box.space, tbl: Protocol.keyBoxTable, id, data, envelope: null, ct: null });
  }

  for (const link of links) {
    const data = yield* Effect.orDie(encodeLink(link));
    const id = Protocol.historyLinkId(link);
    const tbl = Protocol.historyLinkTable;
    puts.push({ space: link.space, tbl, id, data, envelope: null, ct: null });
  }

  for (const write of writes) {
    const envelope = yield* Effect.orDie(encodeEnvelope(write.envelope));
    const { space, id, ct } = write;
    puts.push({ space, tbl: sealedTable, id, data: null, envelope, ct });
  }

  const advanced = [];

  for (const space of spaces) {
    const opened = boxes.some((box) => box.space === space) ? (epochs.get(space) ?? null) : null;

    const [row] = yield* sql<{ readonly version: number }>`
      update space set version = version + 1, key_epoch = coalesce(${opened}::int, key_epoch)
      where id = ${space}
      returning version::float8 as version
    `;

    if (row === undefined) return yield* Effect.die(`The locked space ${space} disappeared`);
    advanced.push({ space, version: row.version });
  }

  const versions = new Map(advanced.map(({ space, version }) => [space, version]));

  for (const put of puts) {
    yield* sql`
      insert into sync_row
        (space_id, tbl, id, version, data, envelope, ct, written_by_client, written_by_mutation)
      values (
        ${put.space}, ${put.tbl}, ${put.id}, ${versions.get(put.space) ?? 0}, ${put.data}::jsonb,
        ${put.envelope}::jsonb, ${put.ct}, ${client}, ${command.mutationId}
      )
      on conflict (space_id, tbl, id) do update set
        version = excluded.version, data = excluded.data, envelope = excluded.envelope,
        ct = excluded.ct, written_by_client = excluded.written_by_client,
        written_by_mutation = excluded.written_by_mutation
    `;
  }

  return Decision.Applied({ spaces: advanced, accounts: [] });
});
